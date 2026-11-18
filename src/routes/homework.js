'use strict';

/**
 * Envio do homework pelo aluno (foto, PDF ou Word) e abertura dos arquivos enviados.
 *
 * Fluxo (igual ao dos materiais do admin, para o arquivo não passar pela função da Vercel):
 *   1) POST /:key/uploads          -> confere tipo, tamanho e nível; devolve uma URL de envio
 *   2) PUT  (URL de envio)          -> o navegador manda o arquivo direto para o armazenamento
 *   3) POST /uploads/:id/finish     -> confere se chegou, o tamanho e se o conteúdo é mesmo
 *                                      foto/PDF/Word; aí o homework aparece para a professora
 *
 * Quem abre um arquivo: o próprio aluno e a equipe (professora/admin). Ninguém mais.
 */
const express = require('express');
const db = require('../db');
const { ah, requireAuth, requirePlacement, rateLimit } = require('../auth');
const { HOMEWORK_BY_KEY } = require('../lessons/catalog');
const { unlockedLevels } = require('../levels');
const {
  storage, SUBMISSION_TYPES, SUBMISSION_MAX_MB, SUBMISSION_MAX_BYTES, extOf, isSubmissionPath, newSubmissionPath, matchesType,
} = require('../storage');
const { canPreview, buildPreviewPage } = require('../preview');
const { MAX_FILES_PER_HOMEWORK, submissionsOf, cleanupStale } = require('../homework');
const notify = require('../notifications');

const router = express.Router();
router.use(requireAuth);

const isStaff = (user) => user.role === 'teacher' || user.role === 'admin';
const MIN = 60 * 1000;
const uploadLimiter = rateLimit([
  { name: 'hw-upload', windowMs: 60 * MIN, max: 60, keyFn: (req) => `u${req.user?.id}` },
]);

async function findHomework(req, res) {
  const hw = HOMEWORK_BY_KEY.get(String(req.params.key));
  if (!hw) { res.status(404).json({ error: 'Homework não encontrado.' }); return null; }
  if (!(await unlockedLevels(req.user)).includes(hw.level)) {
    res.status(403).json({ error: 'Este nível será liberado pela sua professora.', code: 'LEVEL_LOCKED' });
    return null;
  }
  return hw;
}

const state = async (userId, key) => (await submissionsOf(userId, [key])).get(key)
  || { files: [], review: null, pending: false, lastAt: null };

/** Situação do aluno neste homework (arquivos enviados e correção). */
router.get('/:key/mine', requirePlacement, ah(async (req, res) => {
  const hw = await findHomework(req, res);
  if (!hw) return;
  res.json(await state(req.user.id, hw.key));
}));

/** 1) Pede para enviar um arquivo. */
router.post('/:key/uploads', requirePlacement, uploadLimiter, ah(async (req, res) => {
  const hw = await findHomework(req, res);
  if (!hw) return;
  if (!(await db.one('SELECT 1 FROM homework_files WHERE key = $1', [hw.key]))) {
    return res.status(404).json({ error: 'Este homework ainda não foi publicado.' });
  }
  const originalName = typeof req.body?.originalName === 'string' ? req.body.originalName.trim().slice(0, 200) : '';
  const size = Number(req.body?.size);
  const ext = extOf(originalName);
  const info = SUBMISSION_TYPES[ext];
  if (!originalName || !info) {
    return res.status(400).json({ error: 'Envie uma foto (JPG, PNG, WEBP ou HEIC), um PDF ou um arquivo do Word (DOC ou DOCX).', code: 'BAD_TYPE' });
  }
  if (!Number.isFinite(size) || size <= 0) return res.status(400).json({ error: 'Arquivo vazio.' });
  if (size > SUBMISSION_MAX_BYTES) {
    return res.status(400).json({ error: `Arquivo maior que ${SUBMISSION_MAX_MB} MB. Tire a foto com menos resolução ou envie um PDF menor.`, code: 'TOO_BIG' });
  }
  const { n } = await db.one(
    "SELECT COUNT(*)::int AS n FROM homework_uploads WHERE user_id = $1 AND hw_key = $2 AND status = 'sent'",
    [req.user.id, hw.key],
  );
  if (n >= MAX_FILES_PER_HOMEWORK) {
    return res.status(400).json({ error: `Você já enviou ${MAX_FILES_PER_HOMEWORK} arquivos neste homework. Remova algum para enviar outro.`, code: 'TOO_MANY' });
  }

  if (Math.random() < 0.05) await cleanupStale().catch(() => {});
  const objectPath = newSubmissionPath(ext);
  const row = await db.one(
    `INSERT INTO homework_uploads (user_id, hw_key, stored_name, original_name, mime_type)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [req.user.id, hw.key, objectPath, originalName, info.mime],
  );
  const upload = storage.name === 'local'
    ? { url: `/api/homework/uploads/${row.id}/local`, method: 'PUT', headers: { 'Content-Type': info.mime } }
    : await storage.createUpload(objectPath, info.mime);
  res.status(201).json({ id: row.id, upload });
}));

const ownUpload = (req, status) => {
  const id = Number(req.params.id);
  return Number.isInteger(id)
    ? db.one(`SELECT * FROM homework_uploads WHERE id = $1 AND user_id = $2 ${status ? 'AND status = $3' : ''}`,
      status ? [id, req.user.id, status] : [id, req.user.id])
    : null;
};

/** 2) Destino do PUT no modo local (desenvolvimento e testes). Em produção vai direto ao Supabase. */
router.put('/uploads/:id/local', ah(async (req, res) => {
  if (storage.name !== 'local') return res.status(404).json({ error: 'Rota indisponível.' });
  const up = await ownUpload(req, 'uploading');
  if (!up || !isSubmissionPath(up.stored_name)) return res.status(404).json({ error: 'Envio não encontrado.' });
  if (await storage.stat(up.stored_name)) return res.status(409).json({ error: 'Arquivo já enviado.' });
  const { size } = await storage.receive(req, up.stored_name);
  res.status(201).json({ ok: true, size });
}));

/** 3) Confirma o envio: o arquivo precisa ter chegado, caber no limite e ser mesmo foto/PDF/Word. */
router.post('/uploads/:id/finish', ah(async (req, res) => {
  const up = await ownUpload(req, 'uploading');
  if (!up) return res.status(404).json({ error: 'Envio não encontrado.' });
  const discard = async (status, error, code) => {
    await storage.remove(up.stored_name).catch(() => {});
    await db.query('DELETE FROM homework_uploads WHERE id = $1', [up.id]);
    return res.status(status).json({ error, code });
  };
  const stat = await storage.stat(up.stored_name);
  if (!stat) return discard(400, 'O arquivo não chegou. Tente enviar de novo.');
  if (stat.size > SUBMISSION_MAX_BYTES) return discard(400, `Arquivo maior que ${SUBMISSION_MAX_MB} MB.`, 'TOO_BIG');
  const ext = extOf(up.stored_name);
  const buffer = await storage.read(up.stored_name);
  if (!matchesType(ext, buffer)) {
    return discard(400, 'Esse arquivo não parece ser uma foto, um PDF ou um documento do Word. Confira e envie de novo.', 'BAD_CONTENT');
  }
  await storage.replace(up.stored_name, buffer, SUBMISSION_TYPES[ext].mime);
  await db.query("UPDATE homework_uploads SET status = 'sent', size_bytes = $1, created_at = now() WHERE id = $2", [buffer.length, up.id]);
  const hw = HOMEWORK_BY_KEY.get(up.hw_key);
  if (hw && req.user.role === 'student') {
    await notify.notifyStaff({
      kind: 'hw_sent', title: `📎 ${req.user.name} enviou o homework ${hw.code} — ${hw.title}`,
      body: 'Abra o Anexo aluno para corrigir.', link: `/professor#anexo=${req.user.id}`, ref: `hw-sent:${req.user.id}:${hw.key}`,
    });
  }
  res.json(await state(req.user.id, up.hw_key));
}));

/** Aluno remove um arquivo que ainda não foi corrigido (mandou errado, por exemplo). */
router.delete('/uploads/:id', ah(async (req, res) => {
  const up = await ownUpload(req, 'sent');
  if (!up) return res.status(404).json({ error: 'Arquivo não encontrado.' });
  const review = await db.one('SELECT reviewed_at FROM homework_reviews WHERE user_id = $1 AND hw_key = $2', [req.user.id, up.hw_key]);
  if (review && new Date(review.reviewed_at) >= new Date(up.created_at)) {
    return res.status(409).json({ error: 'Este arquivo já foi corrigido pela professora e não pode mais ser removido.', code: 'ALREADY_REVIEWED' });
  }
  await db.query('DELETE FROM homework_uploads WHERE id = $1', [up.id]);
  await storage.remove(up.stored_name).catch(() => {});
  res.json(await state(req.user.id, up.hw_key));
}));

/** Arquivo do aluno: só para ele mesmo e para a equipe. */
async function readableUpload(req) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return null;
  const up = await db.one("SELECT * FROM homework_uploads WHERE id = $1 AND status = 'sent'", [id]);
  if (!up || (up.user_id !== req.user.id && !isStaff(req.user))) return null;
  return up;
}

router.get('/uploads/:id/file', ah(async (req, res) => {
  const up = await readableUpload(req);
  if (!up) return res.status(404).json({ error: 'Arquivo não encontrado.' });
  const info = SUBMISSION_TYPES[extOf(up.stored_name)];
  // Foto (menos HEIC, que o navegador não mostra) e PDF abrem na tela; Word baixa.
  const inline = req.query.inline === '1' && (info.kind === 'pdf' || (info.kind === 'image' && extOf(up.stored_name) !== '.heic'));
  await storage.send(res, { stored_name: up.stored_name, original_name: up.original_name, mime_type: info.mime }, { inline });
}));

/** Word (.docx) como página para ler na tela (sem scripts, isolada). */
router.get('/uploads/:id/preview', ah(async (req, res) => {
  const up = await readableUpload(req);
  if (!up) return res.status(404).json({ error: 'Arquivo não encontrado.' });
  if (!canPreview(up.original_name) || extOf(up.stored_name) !== '.docx') {
    return res.status(415).json({ error: 'Pré-visualização indisponível para este formato. Baixe o arquivo.' });
  }
  let html;
  try {
    html = await buildPreviewPage(await storage.read(up.stored_name), up.original_name, up.original_name);
  } catch (err) {
    return res.status(422).json({ error: 'Não foi possível ler este arquivo para pré-visualizar. Baixe o arquivo.' });
  }
  res.set({
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy': "default-src 'none'; img-src data:; style-src 'unsafe-inline'; frame-ancestors 'self'; sandbox allow-popups allow-popups-to-escape-sandbox",
    'Cache-Control': 'private, no-store',
  });
  res.send(html);
}));

module.exports = router;
