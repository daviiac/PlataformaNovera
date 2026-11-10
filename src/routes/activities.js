'use strict';

const express = require('express');
const db = require('../db');
const { ah, requireAuth, requirePlacement } = require('../auth');
const { TYPES, TYPE_KEYS, BUILTIN, BUILTIN_BY_KEY } = require('../activities/catalog');
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
    case 'song': return { n: data.lines.reduce((s, l) => s + (l.text.match(/\[[^\]]+\]/g) || []).length, 0), unit: 'lacunas' };
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
  return row ? fromRow(row) : null;
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
  const rows = await db.query('SELECT type, level, COUNT(*)::int AS n FROM activities GROUP BY type, level');
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
    `SELECT * FROM activities WHERE type = $1 ${level ? 'AND level = $2' : ''} ORDER BY created_at DESC, id DESC`,
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

/** Atividade completa para jogar. */
router.get('/:key', ah(async (req, res) => {
  const a = await findActivity(req.params.key);
  if (!a) return res.status(404).json({ error: 'Atividade não encontrada.' });
  if (!(await unlockedLevels(req.user)).includes(a.level)) return res.status(403).json(LOCKED);
  const best = (await bestScores(req.user.id)).get(a.key) || null;
  res.json({ activity: { ...a, slug: undefined, best }, type: TYPES.find((t) => t.key === a.type) });
}));

/** Registra o resultado de uma tentativa (para o aluno acompanhar o progresso). */
router.post('/:key/attempts', ah(async (req, res) => {
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
  const best = (await bestScores(req.user.id)).get(a.key) || null;
  res.status(201).json({ ok: true, best });
}));

module.exports = router;
