'use strict';

const express = require('express');
const db = require('../db');
const { ah, requireAuth, requirePlacement, rateLimit } = require('../auth');

// Limite de gravações por aluno (resultados e progresso): evita encher o banco com pedidos em massa.
// Folgado para o uso normal (o progresso é salvo a cada resposta).
const writeLimiter = rateLimit([
  { name: 'activity-write', windowMs: 10 * 60 * 1000, max: 600, keyFn: (req) => `u${req.user?.id}` },
]);
const { TYPES, TYPE_KEYS, BUILTIN, BUILTIN_BY_KEY, isLyricsSong } = require('../activities/catalog');

// Músicas antigas com a letra completa ficam ocultas para os alunos (direitos autorais).
const VISIBLE = "(type <> 'song' OR data->'questions' IS NOT NULL)";
const { unlockedLevels } = require('../levels');

const router = express.Router();
router.use(requireAuth, requirePlacement);

const LEVELS = ['A1', 'A2', 'B2'];

/** Quantidade de itens de uma atividade (para mostrar no cartão). */
function itemCount(type, data) {
  switch (type) {
    case 'listen': return { n: data.questions.length, unit: 'perguntas' };
    case 'dictation': return { n: data.sentences.length, unit: 'frases' };
    case 'grammar_quiz': return { n: data.items.length, unit: 'questões' };
    case 'word_order': return { n: data.sentences.length, unit: 'frases' };
    case 'text_correction': return { n: (data.text.match(/\[[^\]]+\]/g) || []).length, unit: 'erros' };
    case 'worksheet': return { n: data.pages.length, unit: 'páginas' };
    case 'quiz': return { n: data.questions.length, unit: 'perguntas' };
    case 'song': if (data.questions) return { n: data.questions.length, unit: 'perguntas' };
      return { n: data.lines.reduce((s, l) => s + (l.text.match(/\[[^\]]+\]/g) || []).length, 0), unit: 'lacunas' };
    default: return null;
  }
}

function fromRow(row) {
  return {
    key: `a-${row.id}`,
    id: row.id,
    type: row.type,
    level: row.level,
    title: row.title,
    description: row.description,
    data: row.data,
    builtin: false,
    createdAt: row.created_at,
  };
}

function summary(a, best) {
  return {
    key: a.key,
    type: a.type,
    level: a.level,
    title: a.title,
    description: a.description,
    builtin: a.builtin,
    count: itemCount(a.type, a.data),
    youtubeId: a.data.youtubeId || null,
    cover: a.data.cover || null,
    best: best || null,
  };
}

async function findActivity(key) {
  if (BUILTIN_BY_KEY.has(key)) return BUILTIN_BY_KEY.get(key);
  const m = /^a-(\d+)$/.exec(key || '');
  if (!m) return null;
  const row = await db.one('SELECT * FROM activities WHERE id = $1', [Number(m[1])]);
  return row && !isLyricsSong(row) ? fromRow(row) : null;
}

async function bestScores(userId) {
  const rows = await db.query(`
    SELECT DISTINCT ON (activity_key) activity_key, score, total
    FROM activity_attempts WHERE user_id = $1
    ORDER BY activity_key, (score::float / NULLIF(total, 0)) DESC NULLS LAST, created_at DESC
  `, [userId]);
  return new Map(rows.map((r) => [r.activity_key, { score: r.score, total: r.total }]));
}

/** Tipos de atividade com a quantidade por nível. */
router.get('/types', ah(async (req, res) => {
  const counts = {};
  for (const t of TYPE_KEYS) counts[t] = { A1: 0, A2: 0, B2: 0 };
  for (const a of BUILTIN) counts[a.type][a.level] += 1;
  const rows = await db.query(`SELECT type, level, COUNT(*)::int AS n FROM activities WHERE ${VISIBLE} GROUP BY type, level`);
  for (const r of rows) if (counts[r.type]) counts[r.type][r.level] += r.n;
  res.json({
    userLevel: req.user.level,
    isAdmin: req.user.role === 'admin',
    types: TYPES.map((t) => ({ ...t, counts: counts[t.key], total: LEVELS.reduce((s, l) => s + counts[t.key][l], 0) })),
  });
}));

/** Lista de atividades de um tipo (e opcionalmente de um nível). */
router.get('/', ah(async (req, res) => {
  const type = String(req.query.type || '');
  if (!TYPE_KEYS.includes(type)) return res.status(400).json({ error: 'Tipo de atividade inválido.' });
  const level = req.query.level ? String(req.query.level).toUpperCase() : null;
  if (level && !LEVELS.includes(level)) return res.status(400).json({ error: 'Nível inválido.' });

  const builtin = BUILTIN.filter((a) => a.type === type && (!level || a.level === level));
  const rows = await db.query(
    `SELECT * FROM activities WHERE type = $1 AND ${VISIBLE} ${level ? 'AND level = $2' : ''} ORDER BY created_at DESC, id DESC`,
    level ? [type, level] : [type],
  );
  const [best, unlocked] = await Promise.all([bestScores(req.user.id), unlockedLevels(req.user)]);
  const all = [...rows.map(fromRow), ...builtin];
  res.json({
    type: TYPES.find((t) => t.key === type),
    userLevel: req.user.level,
    unlocked,
    activities: all.map((a) => ({ ...summary(a, best.get(a.key)), locked: !unlocked.includes(a.level) })),
  });
}));

const LOCKED = { error: 'Este nível será liberado pela sua professora.', code: 'LEVEL_LOCKED' };

/** Atividades que o aluno começou e não terminou (para lembrar quando ele voltar). */
router.get('/pending', ah(async (req, res) => {
  const [rows, unlocked] = await Promise.all([
    db.query('SELECT activity_key, answered, correct, total, updated_at FROM activity_progress WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 30', [req.user.id]),
    unlockedLevels(req.user),
  ]);
  const pending = [];
  for (const r of rows) {
    const a = await findActivity(r.activity_key);
    if (!a || !unlocked.includes(a.level)) continue;
    const t = TYPES.find((x) => x.key === a.type);
    pending.push({
      key: a.key, title: a.title, level: a.level, type: a.type, typeLabel: t?.label, icon: t?.icon,
      answered: r.answered, total: r.total, percent: Math.round((r.answered / r.total) * 100), updatedAt: r.updated_at,
    });
  }
  res.json({ pending });
}));

/** Atividade completa para jogar. */
router.get('/:key', ah(async (req, res) => {
  const a = await findActivity(req.params.key);
  if (!a) return res.status(404).json({ error: 'Atividade não encontrada.' });
  if (!(await unlockedLevels(req.user)).includes(a.level)) return res.status(403).json(LOCKED);
  const [scores, prog] = await Promise.all([
    bestScores(req.user.id),
    db.one('SELECT answered, correct, total, state FROM activity_progress WHERE user_id = $1 AND activity_key = $2', [req.user.id, a.key]),
  ]);
  const best = scores.get(a.key) || null;
  // Progresso guardado: o aluno continua de onde parou.
  const progress = prog ? { answered: prog.answered, correct: prog.correct, total: prog.total, state: prog.state || null } : null;
  res.json({ activity: { ...a, slug: undefined, best, progress }, type: TYPES.find((t) => t.key === a.type) });
}));

/** Registra o resultado de uma tentativa (para o aluno acompanhar o progresso). */
router.post('/:key/attempts', writeLimiter, ah(async (req, res) => {
  const a = await findActivity(req.params.key);
  if (!a) return res.status(404).json({ error: 'Atividade não encontrada.' });
  if (!(await unlockedLevels(req.user)).includes(a.level)) return res.status(403).json(LOCKED);
  const total = Number(req.body?.total);
  const score = Number(req.body?.score);
  if (!Number.isInteger(total) || total < 1 || total > 500 || !Number.isInteger(score) || score < 0 || score > total) {
    return res.status(400).json({ error: 'Resultado inválido.' });
  }
  await db.query('INSERT INTO activity_attempts (user_id, activity_key, score, total) VALUES ($1, $2, $3, $4)',
    [req.user.id, a.key, score, total]);
  // Concluiu: deixa de estar pendente.
  await db.query('DELETE FROM activity_progress WHERE user_id = $1 AND activity_key = $2', [req.user.id, a.key]);
  const best = (await bestScores(req.user.id)).get(a.key) || null;
  res.status(201).json({ ok: true, best });
}));

/** Progresso parcial (atividade começada): enviado a cada resposta, enquanto não termina. */
router.put('/:key/progress', writeLimiter, ah(async (req, res) => {
  const a = await findActivity(req.params.key);
  if (!a) return res.status(404).json({ error: 'Atividade não encontrada.' });
  if (!(await unlockedLevels(req.user)).includes(a.level)) return res.status(403).json(LOCKED);
  const total = Number(req.body?.total);
  const answered = Number(req.body?.answered);
  const correct = Number(req.body?.correct);
  const int = (n, max) => Number.isInteger(n) && n >= 0 && n <= max;
  if (!int(total, 500) || total < 1 || !int(answered, total) || !int(correct, answered)) {
    return res.status(400).json({ error: 'Progresso inválido.' });
  }
  // Estado das respostas (para continuar de onde parou): objeto pequeno.
  const raw = req.body?.state;
  const state = raw && typeof raw === 'object' && !Array.isArray(raw) ? JSON.stringify(raw) : null;
  if (state && state.length > 20000) return res.status(400).json({ error: 'Progresso grande demais.' });
  if (answered === 0) {
    await db.query('DELETE FROM activity_progress WHERE user_id = $1 AND activity_key = $2', [req.user.id, a.key]);
    return res.json({ ok: true });
  }
  // Pode chegar a 100% respondido sem ter clicado em Finalizar/Corrigir: continua pendente.
  await db.query(`
    INSERT INTO activity_progress (user_id, activity_key, answered, correct, total, state, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6::jsonb, now())
    ON CONFLICT (user_id, activity_key)
    DO UPDATE SET answered = EXCLUDED.answered, correct = EXCLUDED.correct, total = EXCLUDED.total,
                  state = EXCLUDED.state, updated_at = now()
  `, [req.user.id, a.key, answered, correct, total, state]);
  res.json({ ok: true });
}));

module.exports = router;
