'use strict';

/**
 * Notificações do sino. Cada usuário tem as suas; uma notificação só some quando ele marca
 * como lida. "ref" identifica o assunto: enquanto houver uma não lida com o mesmo ref, ela é
 * atualizada em vez de criar outra (ex.: aluno manda 3 fotos do mesmo homework = 1 aviso).
 *
 * Falha ao notificar nunca atrapalha a ação principal (correção, nível, publicação...).
 */
const db = require('./db');

const clip = (s, n) => String(s ?? '').slice(0, n);
const safeLink = (l) => (typeof l === 'string' && l.startsWith('/') && !l.startsWith('//') ? clip(l, 300) : null);

async function safely(fn) {
  try {
    return await fn();
  } catch (err) {
    console.warn('[notificação]', err.message);
    return null;
  }
}

/** Para um usuário. */
function notifyUser(userId, { kind, title, body = '', link = null, ref = null }) {
  return safely(async () => {
    const values = [userId, clip(kind, 40), clip(title, 200), clip(body, 1000), safeLink(link), ref ? clip(ref, 200) : null];
    if (ref) {
      const updated = await db.one(
        `UPDATE notifications SET kind = $2, title = $3, body = $4, link = $5, created_at = now()
         WHERE id = (SELECT id FROM notifications WHERE user_id = $1 AND ref = $6 AND read_at IS NULL ORDER BY id DESC LIMIT 1)
         RETURNING id`,
        values,
      );
      if (updated) return updated.id;
    }
    return (await db.one(
      'INSERT INTO notifications (user_id, kind, title, body, link, ref) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      values,
    )).id;
  });
}

/** Para vários usuários de uma vez (quem escolhe é o WHERE). Pula quem já tem a mesma não lida. */
function notifyWhere(where, params, { kind, title, body = '', link = null, ref = null }) {
  return safely(async () => {
    const n = params.length;
    await db.query(
      `INSERT INTO notifications (user_id, kind, title, body, link, ref)
       SELECT u.id, $${n + 1}, $${n + 2}, $${n + 3}, $${n + 4}, $${n + 5} FROM users u
       WHERE u.active AND NOT u.approval_pending AND (${where})
         AND ($${n + 5}::text IS NULL OR NOT EXISTS (
           SELECT 1 FROM notifications x WHERE x.user_id = u.id AND x.ref = $${n + 5} AND x.read_at IS NULL))`,
      [...params, clip(kind, 40), clip(title, 200), clip(body, 1000), safeLink(link), ref ? clip(ref, 200) : null],
    );
  });
}

/** Alunos que têm o nível liberado (o nível atual ou um em que já estiveram). */
const notifyLevel = (level, n) => notifyWhere(
  `u.role = 'student' AND (u.level = $1 OR EXISTS (
     SELECT 1 FROM level_changes lc WHERE lc.user_id = u.id AND (lc.from_level = $1 OR lc.to_level = $1)))`,
  [level], n,
);

/** Professora(s) e administrador. */
const notifyStaff = (n) => notifyWhere("u.role IN ('teacher', 'admin')", [], n);

/** Assunto resolvido (ex.: cadastro aprovado, homework corrigido): marca como lida para todos. */
const resolve = (ref) => safely(() => db.query('UPDATE notifications SET read_at = now() WHERE ref = $1 AND read_at IS NULL', [ref]));

/** Aluno excluído: os avisos sobre ele (cadastro, homework enviado) saem do sino da equipe. */
const resolveStudent = (id) => safely(() => db.query(
  'UPDATE notifications SET read_at = now() WHERE (ref = $1 OR ref LIKE $2) AND read_at IS NULL',
  [`signup:${id}`, `hw-sent:${id}:%`],
));

/** Limpeza ocasional: lidas há mais de 120 dias. */
const cleanup = () => safely(() => db.query("DELETE FROM notifications WHERE read_at < now() - interval '120 days'"));

module.exports = { notifyUser, notifyLevel, notifyStaff, resolve, resolveStudent, cleanup };
