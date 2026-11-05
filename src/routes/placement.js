'use strict';

const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');
const { publicQuestions, grade, QUESTIONS } = require('../placement');

const router = express.Router();
router.use(requireAuth);

router.get('/questions', (req, res) => {
  const last = db.prepare(
    'SELECT level, score, max_score, created_at FROM placement_results WHERE user_id = ? ORDER BY id DESC LIMIT 1',
  ).get(req.user.id);
  res.json({ questions: publicQuestions(), currentLevel: req.user.level, lastResult: last || null });
});

router.post('/submit', (req, res) => {
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

  db.prepare(
    'INSERT INTO placement_results (user_id, level, score, max_score, details) VALUES (?, ?, ?, ?, ?)',
  ).run(req.user.id, result.level, result.score, result.maxScore, JSON.stringify(result.byBand));

  // O administrador pode testar o nivelamento sem ter um "nível" de aluno.
  if (req.user.role === 'student') {
    db.prepare('UPDATE users SET level = ? WHERE id = ?').run(result.level, req.user.id);
  }

  res.json({ result });
});

module.exports = router;
