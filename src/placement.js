'use strict';

/**
 * Banco de questões do nivelamento. As respostas corretas ficam apenas no
 * servidor; o cliente recebe só enunciado e alternativas, e a correção é feita aqui.
 *
 * Cada questão pertence a uma faixa (A1, A2, B2) e vale pontos proporcionais à
 * dificuldade: A1 = 1, A2 = 2, B2 = 3.
 */
const QUESTIONS = [
  // ---- Faixa A1 ----
  { id: 'a1-1', band: 'A1', skill: 'Gramática', prompt: 'She ___ a teacher.', options: ['am', 'is', 'are', 'be'], answer: 1 },
  { id: 'a1-2', band: 'A1', skill: 'Gramática', prompt: 'I ___ coffee every morning.', options: ['drinks', 'drinking', 'drink', 'am drink'], answer: 2 },
  { id: 'a1-3', band: 'A1', skill: 'Vocabulário', prompt: "The opposite of 'hot' is ___.", options: ['cold', 'warm', 'big', 'fast'], answer: 0 },
  { id: 'a1-4', band: 'A1', skill: 'Gramática', prompt: 'There ___ two apples on the table.', options: ['is', 'am', 'be', 'are'], answer: 3 },
  { id: 'a1-5', band: 'A1', skill: 'Vocabulário', prompt: 'Which word is a day of the week?', options: ['March', 'Tuesday', 'Summer', 'Morning'], answer: 1 },

  // ---- Faixa A2 ----
  { id: 'a2-1', band: 'A2', skill: 'Gramática', prompt: 'Yesterday we ___ to the cinema.', options: ['go', 'goes', 'went', 'gone'], answer: 2 },
  { id: 'a2-2', band: 'A2', skill: 'Gramática', prompt: 'This book is ___ than that one.', options: ['more interesting', 'most interesting', 'interestinger', 'as interesting'], answer: 0 },
  { id: 'a2-3', band: 'A2', skill: 'Gramática', prompt: 'I ___ TV when the phone rang.', options: ['watched', 'am watching', 'watch', 'was watching'], answer: 3 },
  { id: 'a2-4', band: 'A2', skill: 'Vocabulário', prompt: 'I need to ___ an appointment with the dentist.', options: ['do', 'make', 'take', 'have'], answer: 1 },
  { id: 'a2-5', band: 'A2', skill: 'Gramática', prompt: 'Have you ever ___ to London?', options: ['been', 'be', 'was', 'went'], answer: 0 },

  // ---- Faixa B2 ----
  { id: 'b2-1', band: 'B2', skill: 'Gramática', prompt: 'If I ___ about the problem, I would have helped you.', options: ['knew', 'have known', 'had known', 'would know'], answer: 2 },
  { id: 'b2-2', band: 'B2', skill: 'Gramática', prompt: 'The report ___ by the time the manager arrives tomorrow.', options: ['will finish', 'has finished', 'is finishing', 'will have been finished'], answer: 3 },
  { id: 'b2-3', band: 'B2', skill: 'Vocabulário', prompt: 'The company decided to ___ the project because of budget cuts.', options: ['put off', 'put up with', 'put on', 'put across'], answer: 0 },
  { id: 'b2-4', band: 'B2', skill: 'Gramática', prompt: 'Not only ___ late, but he also forgot the documents.', options: ['he arrived', 'did he arrive', 'he did arrive', 'arrived he'], answer: 1 },
  { id: 'b2-5', band: 'B2', skill: 'Vocabulário', prompt: 'Her argument was so ___ that everyone in the room agreed with her.', options: ['compelled', 'compulsive', 'compelling', 'complying'], answer: 2 },
];

const POINTS = { A1: 1, A2: 2, B2: 3 };
const MAX_SCORE = QUESTIONS.reduce((sum, q) => sum + POINTS[q.band], 0); // 30

// Limiares de pontuação ponderada (0–30).
// A1: 0–11 · A2: 12–21 · B2: 22–30
const THRESHOLDS = { A2: 12, B2: 22 };

function publicQuestions() {
  return QUESTIONS.map(({ id, band, skill, prompt, options }) => ({ id, band, skill, prompt, options }));
}

/**
 * @param {Record<string, number>} answers mapa idQuestão -> índice da alternativa
 */
function grade(answers) {
  const byBand = { A1: { correct: 0, total: 0 }, A2: { correct: 0, total: 0 }, B2: { correct: 0, total: 0 } };
  let score = 0;

  for (const q of QUESTIONS) {
    byBand[q.band].total += 1;
    const chosen = answers[q.id];
    if (Number.isInteger(chosen) && chosen === q.answer) {
      byBand[q.band].correct += 1;
      score += POINTS[q.band];
    }
  }

  let level = 'A1';
  if (score >= THRESHOLDS.B2) level = 'B2';
  else if (score >= THRESHOLDS.A2) level = 'A2';

  const correct = Object.values(byBand).reduce((s, b) => s + b.correct, 0);
  return { level, score, maxScore: MAX_SCORE, correct, total: QUESTIONS.length, byBand };
}

module.exports = { QUESTIONS, publicQuestions, grade, MAX_SCORE, THRESHOLDS };
