'use strict';

/**
 * Controle Professor(a): resultados de todos os alunos cadastrados, por categoria.
 * Acesso exclusivo do perfil "teacher" (verificado no servidor).
 */
const crypto = require('node:crypto');
const express = require('express');
const db = require('../db');
const { ah, requireTeacher, hashPassword, resetRateLimit } = require('../auth');
const PasswordPolicy = require('../../public/js/password-policy');
const { TYPES, BUILTIN_BY_KEY } = require('../activities/catalog');
const { ORDER, levelHistory, unlockedLevels } = require('../levels');

const router = express.Router();
router.use(requireTeacher);

// Tipos que não têm acerto/erro (só "concluído").
const UNSCORED = new Set(['grammar_lesson', 'video_lesson']);

const CATEGORIES = [
  { key: 'placement', label: 'Teste de nivelamento', icon: '🎯' },
  ...TYPES.filter((t) => !UNSCORED.has(t.key)).map((t) => ({ key: t.key, label: t.label, icon: t.icon })),
];

/** Descobre tipo, título e nível de cada atividade (próprias da Novera e criadas no painel). */
async function activityIndex(keys) {
  const index = new Map();
  const adminIds = [];
  for (const k of keys) {
    const b = BUILTIN_BY_KEY.get(k);
    if (b) index.set(k, { type: b.type, title: b.title, level: b.level });
    else if (/^a-\d+$/.test(k)) adminIds.push(Number(k.slice(2)));
  }
  if (adminIds.length) {
    const rows = await db.query('SELECT id, type, title, level FROM activities WHERE id = ANY($1::int[])', [adminIds]);
    for (const r of rows) index.set(`a-${r.id}`, { type: r.type, title: r.title, level: r.level });
  }
  return index;
}

router.get('/overview', ah(async (req, res) => {
  const [students, grouped, placements] = await Promise.all([
    db.query(`
      SELECT u.id, u.name, u.email, u.level, u.created_at, lc.from_level AS previous_level, lc.created_at AS level_changed_at
      FROM users u
      LEFT JOIN LATERAL (
        SELECT from_level, created_at FROM level_changes WHERE user_id = u.id AND from_level IS NOT NULL
        ORDER BY created_at DESC, id DESC LIMIT 1
      ) lc ON true
      WHERE u.role = 'student' ORDER BY u.name, u.id`),
    db.query(`
      SELECT user_id, activity_key, COUNT(*)::int AS attempts, SUM(score)::int AS hits,
             SUM(total - score)::int AS misses, MAX(created_at) AS last_at
      FROM activity_attempts GROUP BY user_id, activity_key
    `),
    db.query(`
      SELECT user_id, COUNT(*)::int AS attempts,
             SUM(score)::int AS points, SUM(max_score - score)::int AS lost, MAX(created_at) AS last_at
      FROM placement_results GROUP BY user_id
    `),
  ]);

  const index = await activityIndex([...new Set(grouped.map((g) => g.activity_key))]);
  const byUser = new Map(students.map((s) => [s.id, {
    ...s, categories: {}, done: 0, hits: 0, misses: 0, attempts: 0, lastAt: null,
  }]));

  const bump = (u, cat, g) => {
    const c = u.categories[cat] || (u.categories[cat] = { attempts: 0, hits: 0, misses: 0, activities: 0, lastAt: null });
    c.attempts += g.attempts;
    c.hits += g.hits;
    c.misses += g.misses;
    c.activities += 1;
    if (!c.lastAt || g.last_at > c.lastAt) c.lastAt = g.last_at;
    if (!u.lastAt || g.last_at > u.lastAt) u.lastAt = g.last_at;
  };

  for (const g of grouped) {
    const u = byUser.get(g.user_id);
    const info = index.get(g.activity_key);
    if (!u || !info) continue;
    if (UNSCORED.has(info.type)) { u.done += 1; continue; }
    bump(u, info.type, g);
    u.hits += g.hits;
    u.misses += g.misses;
    u.attempts += g.attempts;
  }
  for (const p of placements) {
    const u = byUser.get(p.user_id);
    if (u) bump(u, 'placement', { attempts: p.attempts, hits: p.points, misses: p.lost, last_at: p.last_at });
  }

  res.json({ categories: CATEGORIES, students: [...byUser.values()] });
}));

router.get('/students/:id', ah(async (req, res) => {
  const id = Number(req.params.id);
  const student = Number.isInteger(id)
    ? await db.one(`SELECT id, name, email, level, created_at FROM users WHERE id = $1 AND role = 'student'`, [id])
    : null;
  if (!student) return res.status(404).json({ error: 'Aluno não encontrado.' });

  const [attempts, placements] = await Promise.all([
    db.query('SELECT activity_key, score, total, created_at FROM activity_attempts WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT 500', [id]),
    db.query('SELECT level, score, max_score, created_at FROM placement_results WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT 50', [id]),
  ]);
  const index = await activityIndex([...new Set(attempts.map((a) => a.activity_key))]);

  const rows = attempts.map((a) => {
    const info = index.get(a.activity_key) || { type: null, title: '(atividade removida)', level: null };
    return {
      category: info.type,
      title: info.title,
      level: info.level,
      hits: a.score,
      misses: a.total - a.score,
      total: a.total,
      scored: !UNSCORED.has(info.type),
      at: a.created_at,
    };
  });
  for (const p of placements) {
    rows.push({ category: 'placement', title: `Nivelamento → ${p.level}`, level: p.level, hits: p.score, misses: p.max_score - p.score, total: p.max_score, scored: true, points: true, at: p.created_at });
  }
  rows.sort((a, b) => new Date(b.at) - new Date(a.at));

  const history = await levelHistory(id);
  res.json({
    student,
    categories: CATEGORIES,
    attempts: rows,
    levelHistory: history.map((h) => ({ from: h.from_level, to: h.to_level, at: h.created_at, by: h.changed_by_name || 'Nivelamento' })),
  });
}));

/**
 * Altera o nível do aluno (somente professor(a) e administrador).
 * O nível anterior continua liberado para o aluno; os seguintes só abrem quando
 * a professora mudar o nível de novo.
 */
router.patch('/students/:id/level', ah(async (req, res) => {
  const id = Number(req.params.id);
  const level = String(req.body?.level || '').toUpperCase();
  if (!ORDER.includes(level)) return res.status(400).json({ error: 'Escolha A1, A2 ou B2.' });
  const student = Number.isInteger(id) ? await db.one("SELECT id, level FROM users WHERE id = $1 AND role = 'student'", [id]) : null;
  if (!student) return res.status(404).json({ error: 'Aluno não encontrado.' });
  if (student.level === level) return res.status(400).json({ error: `O aluno já está no nível ${level}.` });

  await db.query('UPDATE users SET level = $1 WHERE id = $2', [level, id]);
  await db.query('INSERT INTO level_changes (user_id, from_level, to_level, changed_by) VALUES ($1, $2, $3, $4)',
    [id, student.level, level, req.user.id]);
  const unlocked = await unlockedLevels({ id, role: 'student', level });
  res.json({ ok: true, from: student.level, to: level, unlocked });
}));

/** Senha provisória legível (sem 0/O, 1/l/I) que sempre passa nas regras de senha. */
function temporaryPassword(ctx) {
  const pick = (set) => set[crypto.randomInt(set.length)];
  const UP = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const LO = 'abcdefghjkmnpqrstuvwxyz';
  const DG = '23456789';
  const SY = '#@!$%';
  for (;;) {
    const part = (n) => Array.from({ length: n }, () => pick(pick([UP, LO, DG]))).join('');
    const pw = `${pick(UP)}${pick(LO)}${part(2)}-${part(4)}-${pick(DG)}${pick(SY)}`;
    if (PasswordPolicy.check(pw, ctx).ok) return pw;
  }
}

/**
 * Redefine a senha de um aluno (professor(a) e administrador).
 * Gera uma senha provisória, mostrada UMA vez para a professora passar ao aluno; no próximo
 * login o aluno é obrigado a criar uma senha nova. As sessões abertas do aluno são encerradas.
 */
router.post('/students/:id/reset-password', ah(async (req, res) => {
  const id = Number(req.params.id);
  const student = Number.isInteger(id)
    ? await db.one("SELECT id, name, email FROM users WHERE id = $1 AND role = 'student'", [id])
    : null;
  if (!student) return res.status(404).json({ error: 'Aluno não encontrado.' });

  const temp = temporaryPassword({ name: student.name, email: student.email });
  await db.query('UPDATE users SET password_hash = $1, must_change_password = true WHERE id = $2', [await hashPassword(temp), id]);
  await db.query('DELETE FROM sessions WHERE user_id = $1', [id]);
  // Libera novas tentativas de login para o aluno entrar com a senha provisória.
  await resetRateLimit('login-account', String(student.email || '').toLowerCase());
  res.json({ ok: true, tempPassword: temp, student: { id: student.id, name: student.name, email: student.email } });
}));

module.exports = router;
