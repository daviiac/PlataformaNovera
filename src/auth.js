'use strict';

const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const db = require('./db');
const { BCRYPT_COST, SESSION_TTL_MS, IS_PRODUCTION } = require('./config');

const COOKIE_NAME = 'novera_session';

// Hash usado quando o usuário não existe, para que o tempo de resposta do login
// não revele quais contas existem.
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), BCRYPT_COST);

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_COST);
}

async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash || DUMMY_HASH);
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: IS_PRODUCTION,
    path: '/',
  };
}

/** Cria uma sessão opaca. Só o hash SHA-256 do token fica no banco. */
function createSession(res, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .run(sha256(token), userId, Date.now() + SESSION_TTL_MS);
  res.cookie(COOKIE_NAME, token, { ...cookieOptions(), maxAge: SESSION_TTL_MS });
}

function destroySession(req, res) {
  const token = req.cookies?.[COOKIE_NAME];
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
  res.clearCookie(COOKIE_NAME, cookieOptions());
}

/** Middleware global: popula req.user a partir do cookie de sessão (ou null). */
function loadUser(req, res, next) {
  req.user = null;
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return next();

  const row = db.prepare(`
    SELECT u.id, u.name, u.email, u.username, u.role, u.level, s.expires_at, s.token_hash
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ?
  `).get(sha256(token));

  if (!row || row.expires_at < Date.now()) {
    if (row) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(row.token_hash);
    res.clearCookie(COOKIE_NAME, cookieOptions());
    return next();
  }

  req.user = {
    id: row.id,
    name: row.name,
    email: row.email,
    username: row.username,
    role: row.role,
    level: row.level,
  };
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Faça login para continuar.', code: 'UNAUTHENTICATED' });
  next();
}

/** Autorização no servidor: só o perfil admin passa. */
function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Faça login para continuar.', code: 'UNAUTHENTICATED' });
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso restrito ao administrador.', code: 'FORBIDDEN' });
  }
  next();
}

/** Alunos precisam ter feito o nivelamento antes de acessar as trilhas. */
function requirePlacement(req, res, next) {
  if (req.user.role !== 'admin' && !req.user.level) {
    return res.status(403).json({ error: 'Faça o teste de nivelamento primeiro.', code: 'PLACEMENT_REQUIRED' });
  }
  next();
}

/** Limitador simples em memória contra força bruta no login/cadastro. */
function rateLimit({ windowMs, max, keyFn }) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) if (entry.resetAt <= now) hits.delete(key);
  }, windowMs).unref();

  return (req, res, next) => {
    const key = keyFn(req);
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({ error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' });
    }
    next();
  };
}

module.exports = {
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
  loadUser,
  requireAuth,
  requireAdmin,
  requirePlacement,
  rateLimit,
};
