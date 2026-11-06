'use strict';

const express = require('express');
const db = require('../db');
const { ah, requireAuth } = require('../auth');
const { publicQuestions, grade, QUESTIONS } = require('../placement');

const router = express.Router();
router.use(requireAuth);

router.get('/questions', ah(async (req, res) => {
  const last = await db.one(
    'SELECT level, score, max_score, created_at FROM placement_results WHERE user_id = $1 ORDER BY id DESC LIMIT 1',
    [req.user.id],
  );
  res.json({ questions: publicQuestions(), currentLevel: req.user.level, lastResult: last });
}));

router.post('/submit', ah(async (req, res) => {
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

  // O administrador pode testar o nivelamento sem ter um "nível" de aluno.
  if (req.user.role === 'student') {
    await db.query('UPDATE users SET level = $1 WHERE id = $2', [result.level, req.user.id]);
  }

  res.json({ result });
}));

module.exports = router;
