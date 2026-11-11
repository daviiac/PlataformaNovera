'use strict';

const express = require('express');
const db = require('../db');
const { ah, requireAuth, rateLimit } = require('../auth');
const { publicQuestions, grade, QUESTIONS } = require('../placement');

const router = express.Router();
router.use(requireAuth);

// Nivelamento: poucas tentativas por hora por aluno (o resultado muda o nível).
const submitLimiter = rateLimit([
  { name: 'placement-submit', windowMs: 60 * 60 * 1000, max: 20, keyFn: (req) => `u${req.user?.id}` },
]);

router.get('/questions', ah(async (req, res) => {
  const last = await db.one(
    'SELECT level, score, max_score, created_at FROM placement_results WHERE user_id = $1 ORDER BY id DESC LIMIT 1',
    [req.user.id],
  );
  res.json({ questions: publicQuestions(), currentLevel: req.user.level, lastResult: last });
}));

router.post('/submit', submitLimiter, ah(async (req, res) => {
  const raw = req.body?.answers;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return res.status(400).json({ error: 'Envie as respostas no formato { answers: { idQuestão: índice } }.' });
  }

  const answers = {};
  for (const q of QUESTIONS) {
    const v = raw[q.id];
    if (Number.isInteger(v) && v >= 0 && v < q.options.length) answers[q.id] = v;
  }
  const answered = Object.keys(answers).length;
  if (answered < QUESTIONS.length) {
    return res.status(400).json({ error: `Responda todas as questões (${answered}/${QUESTIONS.length}).` });
  }

  const result = grade(answers);

  await db.query(
    'INSERT INTO placement_results (user_id, level, score, max_score, details) VALUES ($1, $2, $3, $4, $5)',
    [req.user.id, result.level, result.score, result.maxScore, JSON.stringify(result.byBand)],
  );

  // O nivelamento define o nível só na PRIMEIRA vez (aluno ainda sem nível).
  // Depois disso, quem muda o nível é a professora, no Controle Professor(a);
  // o resultado fica registrado para ela avaliar.
  let levelApplied = false;
  if (req.user.role === 'student' && !req.user.level) {
    await db.query('UPDATE users SET level = $1 WHERE id = $2', [result.level, req.user.id]);
    await db.query('INSERT INTO level_changes (user_id, from_level, to_level, changed_by) VALUES ($1, NULL, $2, NULL)',
      [req.user.id, result.level]);
    levelApplied = true;
  }

  res.json({ result, levelApplied, currentLevel: levelApplied ? result.level : req.user.level });
}));

module.exports = router;
