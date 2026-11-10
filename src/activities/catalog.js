'use strict';

/**
 * Catálogo de atividades da Novera.
 *
 *  - Conteúdo próprio (built-in): fica no código (src/activities/content), versionado no git.
 *    Chave: "b-<slug>".
 *  - Conteúdo criado pelo administrador (vídeos do YouTube: quiz, música, videoaula):
 *    fica na tabela "activities". Chave: "a-<id>".
 */
const listen = require('./content/listen');
const dictation = require('./content/dictation');
const { lessons, quizzes } = require('./content/grammar');
const { wordOrder, textCorrection } = require('./content/practice');
const worksheets = [...require('./content/worksheets'), ...require('./content/worksheets2')];

const TYPES = [
  { key: 'quiz', label: 'Quiz em vídeo', icon: '🎬', description: 'Assista a um vídeo e responda às perguntas que aparecem durante ele.', adminCreated: true },
  { key: 'song', label: 'Música', icon: '🎵', description: 'Ouça a música e complete as lacunas da letra.', adminCreated: true },
  { key: 'listen', label: 'Listen', icon: '🎧', description: 'Ouça diálogos e responda às perguntas de compreensão.' },
  { key: 'dictation', label: 'Ditado', icon: '✍️', description: 'Ouça cada frase e escreva o que entendeu.' },
  { key: 'grammar_lesson', label: 'Estudo de Gramática', icon: '📖', description: 'Explicações claras, exemplos e erros comuns.' },
  { key: 'grammar_quiz', label: 'Quiz de Gramática', icon: '🧠', description: 'Traduza e escolha a forma correta.' },
  { key: 'word_order', label: 'Monte a Frase', icon: '🧩', description: 'Coloque as palavras na ordem certa.' },
  { key: 'text_correction', label: 'Corrigir Textos', icon: '🔍', description: 'Encontre as palavras erradas no texto.' },
  { key: 'video_lesson', label: 'Videoaulas', icon: '📺', description: 'Aulas em vídeo selecionadas pela Novera.', adminCreated: true },
  { key: 'worksheet', label: 'Worksheets', icon: '🗂️', description: 'Folhas ilustradas com exercícios corrigidos na hora.' },
];

const TYPE_KEYS = TYPES.map((t) => t.key);
const ADMIN_TYPES = TYPES.filter((t) => t.adminCreated).map((t) => t.key);

const withType = (type) => (item) => ({ ...item, type });

const BUILTIN = [
  ...listen.map(withType('listen')),
  ...dictation.map(withType('dictation')),
  ...lessons,
  ...quizzes,
  ...wordOrder.map(withType('word_order')),
  ...textCorrection.map(withType('text_correction')),
  ...worksheets.map(withType('worksheet')),
].map((a) => ({ ...a, key: `b-${a.slug}`, builtin: true }));

const BUILTIN_BY_KEY = new Map(BUILTIN.map((a) => [a.key, a]));

// ---------------------------------------------------------------------------
// Validação das atividades criadas pelo administrador (dados vindos do formulário)
// ---------------------------------------------------------------------------
class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const fail = (msg) => { throw new ValidationError(msg); };

/** Aceita link do YouTube (watch, youtu.be, shorts, embed) ou o próprio ID. */
function parseYouTubeId(input) {
  const s = str(input, 300);
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  let url;
  try { url = new URL(s); } catch { return null; }
  const host = url.hostname.replace(/^www\.|^m\./, '');
  if (host === 'youtu.be') return /^[A-Za-z0-9_-]{11}$/.test(url.pathname.slice(1)) ? url.pathname.slice(1) : null;
  if (!['youtube.com', 'youtube-nocookie.com', 'music.youtube.com'].includes(host)) return null;
  const v = url.searchParams.get('v');
  if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v;
  const m = url.pathname.match(/^\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

function validateQuiz(data) {
  const questions = Array.isArray(data?.questions) ? data.questions : fail('Adicione ao menos uma pergunta.');
  if (questions.length < 1 || questions.length > 40) fail('O quiz deve ter de 1 a 40 perguntas.');
  return {
    questions: questions.map((q, i) => {
      const n = `Pergunta ${i + 1}`;
      const time = Number(q?.time);
      if (!Number.isFinite(time) || time < 0 || time > 6 * 3600) fail(`${n}: tempo inválido.`);
      const prompt = str(q?.prompt, 300) || fail(`${n}: escreva o enunciado.`);
      const options = (Array.isArray(q?.options) ? q.options : []).map((o) => str(o, 160)).filter(Boolean);
      if (options.length < 2 || options.length > 5) fail(`${n}: informe de 2 a 5 alternativas.`);
      const answer = Number(q?.answer);
      if (!Number.isInteger(answer) || answer < 0 || answer >= options.length) fail(`${n}: marque a alternativa correta.`);
      return { time: Math.round(time), prompt, options, answer };
    }).sort((a, b) => a.time - b.time),
  };
}

function validateSong(data) {
  const raw = Array.isArray(data?.lines) ? data.lines : fail('Escreva a letra da música.');
  if (raw.length < 1 || raw.length > 200) fail('A letra deve ter de 1 a 200 linhas.');
  const lines = raw.map((l, i) => {
    const text = str(l?.text, 300) || fail(`Linha ${i + 1}: vazia.`);
    const time = l?.time === null || l?.time === undefined || l?.time === '' ? null : Number(l.time);
    if (time !== null && (!Number.isFinite(time) || time < 0 || time > 3 * 3600)) fail(`Linha ${i + 1}: tempo inválido.`);
    return { time: time === null ? null : Math.round(time), text };
  });
  const gaps = lines.reduce((n, l) => n + (l.text.match(/\[[^\]]+\]/g) || []).length, 0);
  if (gaps < 1) fail('Marque ao menos uma lacuna com colchetes, ex.: I [love] you.');
  if (gaps > 120) fail('Máximo de 120 lacunas por música.');
  return { lines, artist: str(data?.artist, 120) };
}

function validateVideoLesson(data) {
  return { summary: str(data?.summary, 4000), module: str(data?.module, 120) };
}

const VALIDATORS = { quiz: validateQuiz, song: validateSong, video_lesson: validateVideoLesson };

function validateAdminActivity(body) {
  const type = str(body?.type, 30);
  if (!ADMIN_TYPES.includes(type)) fail('Tipo de atividade inválido.');
  const level = str(body?.level, 4).toUpperCase();
  if (!['A1', 'A2', 'B2'].includes(level)) fail('Escolha o nível (A1, A2 ou B2).');
  const title = str(body?.title, 140);
  if (title.length < 2) fail('Informe o título.');
  const youtubeId = parseYouTubeId(body?.youtube);
  if (!youtubeId) fail('Cole um link válido do YouTube.');
  const data = VALIDATORS[type](body?.data || {});
  return { type, level, title, description: str(body?.description, 400), data: { ...data, youtubeId } };
}

module.exports = {
  TYPES, TYPE_KEYS, ADMIN_TYPES, BUILTIN, BUILTIN_BY_KEY, ValidationError, parseYouTubeId, validateAdminActivity,
};
