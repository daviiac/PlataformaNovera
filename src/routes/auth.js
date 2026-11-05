'use strict';

const express = require('express');
const db = require('../db');
const {
  hashPassword, verifyPassword, createSession, destroySession, rateLimit,
} = require('../auth');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const str = (v) => (typeof v === 'string' ? v.trim() : '');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyFn: (req) => `${req.ip}|${str(req.body?.identifier || req.body?.email).toLowerCase()}`,
});

function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, username: u.username, role: u.role, level: u.level };
}

router.post('/register', limiter, async (req, res, next) => {
  try {
    const name = str(req.body?.name);
    const email = str(req.body?.email).toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (name.length < 2 || name.length > 80) return res.status(400).json({ error: 'Informe um nome entre 2 e 80 caracteres.' });
    if (!EMAIL_RE.test(email) || email.length > 160) return res.status(400).json({ error: 'Informe um e-mail válido.' });
    if (password.length < 8 || password.length > 128) {
      return res.status(400).json({ error: 'A senha deve ter entre 8 e 128 caracteres.' });
    }

    const exists = db.prepare('SELECT 1 FROM users WHERE email = ? OR username = ?').get(email, email);
    if (exists) return res.status(409).json({ error: 'Já existe uma conta com este e-mail.' });

    const passwordHash = await hashPassword(password);
    // O cadastro público sempre cria perfil "student"; não existe rota para virar admin.
    const result = db.prepare(
      "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'student')",
    ).run(name, email, passwordHash);

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    createSession(res, user.id);
    res.status(201).json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.post('/login', limiter, async (req, res, next) => {
  try {
    const identifier = str(req.body?.identifier).toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!identifier || !password) return res.status(400).json({ error: 'Informe usuário/e-mail e senha.' });

    // Aceita e-mail (alunos) ou nome de usuário (administrador).
    const user = db.prepare('SELECT * FROM users WHERE email = ? OR username = ?').get(identifier, identifier);
    const ok = await verifyPassword(password, user?.password_hash);
    if (!user || !ok) return res.status(401).json({ error: 'Usuário ou senha incorretos.' });

    createSession(res, user.id);
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', (req, res) => {
  destroySession(req, res);
  res.json({ ok: true });
});

// Retorna { user: null } quando não há sessão (evita 401 "barulhento" na tela de login).
router.get('/me', (req, res) => {
  res.json({ user: req.user ? publicUser(req.user) : null });
});

module.exports = router;
