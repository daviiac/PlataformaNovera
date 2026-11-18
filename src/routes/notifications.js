'use strict';

/** Sino de notificações: lista, marcar como lida e marcar todas como lidas. */
const express = require('express');
const db = require('../db');
const { ah, requireAuth } = require('../auth');
const { cleanup } = require('../notifications');

const router = express.Router();
router.use(requireAuth);

const dto = (n) => ({
  id: n.id, kind: n.kind, title: n.title, body: n.body, link: n.link, at: n.created_at, read: Boolean(n.read_at),
});

/** Todas as não lidas (mais novas primeiro) e as últimas lidas, para o histórico do sino. */
router.get('/', ah(async (req, res) => {
  const [unread, read] = await Promise.all([
    db.query('SELECT * FROM notifications WHERE user_id = $1 AND read_at IS NULL ORDER BY created_at DESC, id DESC LIMIT 100', [req.user.id]),
    db.query('SELECT * FROM notifications WHERE user_id = $1 AND read_at IS NOT NULL ORDER BY read_at DESC, id DESC LIMIT 15', [req.user.id]),
  ]);
  if (Math.random() < 0.01) cleanup();
  res.json({ unread: unread.length, items: [...unread, ...read].map(dto) });
}));

router.post('/read-all', ah(async (req, res) => {
  await db.query('UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL', [req.user.id]);
  res.json({ ok: true });
}));

router.post('/:id/read', ah(async (req, res) => {
  const id = Number(req.params.id);
  const row = Number.isInteger(id)
    ? await db.one('UPDATE notifications SET read_at = COALESCE(read_at, now()) WHERE id = $1 AND user_id = $2 RETURNING id', [id, req.user.id])
    : null;
  if (!row) return res.status(404).json({ error: 'Notificação não encontrada.' });
  res.json({ ok: true });
}));

module.exports = router;
