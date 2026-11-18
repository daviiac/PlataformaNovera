'use strict';

/**
 * Homework enviado pelo aluno (foto, PDF ou Word) e a correção da professora.
 *
 * Cada arquivo é um registro em homework_uploads. A correção (homework_reviews) vale para o
 * homework inteiro daquele aluno: "correct" (fez certo) ou "redo" (refazer), com comentário.
 * Se o aluno manda arquivo novo depois da correção, o homework volta a "aguardando correção".
 */
const db = require('./db');
const { storage, SUBMISSION_TYPES, extOf } = require('./storage');

const MAX_FILES_PER_HOMEWORK = 10;

function fileDto(f) {
  const info = SUBMISSION_TYPES[extOf(f.stored_name)] || { kind: 'document' };
  return {
    id: f.id, name: f.original_name, size: Number(f.size_bytes), kind: info.kind, ext: extOf(f.stored_name).slice(1),
    at: f.created_at,
    url: `/api/homework/uploads/${f.id}/file`,
  };
}

function reviewDto(r) {
  return r ? { verdict: r.verdict, note: r.note, at: r.reviewed_at, by: r.reviewer_name || null } : null;
}

/** Arquivo mandado depois da última correção = aguardando correção de novo. */
function stateOf(files, review) {
  const last = files.reduce((max, f) => (!max || new Date(f.created_at) > new Date(max) ? f.created_at : max), null);
  const pending = files.length > 0 && (!review || new Date(last) > new Date(review.reviewed_at));
  return {
    files: files.map((f) => ({ ...fileDto(f), canRemove: !review || new Date(f.created_at) > new Date(review.reviewed_at) })),
    review: reviewDto(review),
    pending,
    lastAt: last,
  };
}

/** Situação do aluno em vários homeworks: Map(hw_key -> { files, review, pending, lastAt }). */
async function submissionsOf(userId, keys = null) {
  const filter = keys ? 'AND hw_key = ANY($2)' : '';
  const params = keys ? [userId, keys] : [userId];
  const [files, reviews] = await Promise.all([
    db.query(`SELECT * FROM homework_uploads WHERE user_id = $1 AND status = 'sent' ${filter} ORDER BY created_at, id`, params),
    db.query(`
      SELECT r.*, u.name AS reviewer_name FROM homework_reviews r LEFT JOIN users u ON u.id = r.reviewed_by
      WHERE r.user_id = $1 ${filter}`, params),
  ]);
  const byKey = new Map();
  const all = new Set([...files.map((f) => f.hw_key), ...reviews.map((r) => r.hw_key)]);
  for (const key of all) {
    byKey.set(key, stateOf(files.filter((f) => f.hw_key === key), reviews.find((r) => r.hw_key === key)));
  }
  return byKey;
}

/** Apaga do armazenamento os arquivos enviados por um aluno (antes de excluir o cadastro). */
async function removeAllFiles(userId) {
  const rows = await db.query('SELECT stored_name FROM homework_uploads WHERE user_id = $1', [userId]);
  await Promise.all(rows.map((r) => storage.remove(r.stored_name).catch(() => {})));
}

/** Envios que começaram e nunca terminaram (mais de 1 dia): limpa registro e arquivo. */
async function cleanupStale() {
  const rows = await db.query(
    "DELETE FROM homework_uploads WHERE status = 'uploading' AND created_at < now() - interval '1 day' RETURNING stored_name",
  );
  await Promise.all(rows.map((r) => storage.remove(r.stored_name).catch(() => {})));
}

module.exports = { MAX_FILES_PER_HOMEWORK, submissionsOf, stateOf, fileDto, reviewDto, removeAllFiles, cleanupStale };
