'use strict';

const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const db = require('./db');
const { BCRYPT_COST, SESSION_TTL_MS, IS_PRODUCTION } = require('./config');

const COOKIE_NAME = 'novera_session';

// Hash bcrypt de um valor aleatório descartado. Usado quando o usuário não existe,
// para que o tempo de resposta do login não revele quais contas existem.
// (Constante para não gastar ~300 ms a cada cold start serverless.)
const DUMMY_HASH = '$2a$12$171P7O2CpbMprtOH5h2CBerCYTcAZAbjcepUSF1EbBqxuTeMt8P1S';

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

/** Envolve handlers async para que erros cheguem ao middleware de erro do Express. */
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_COST);
}

function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash || DUMMY_HASH);
}

function cookieOptions() {
  return { httpOnly: true, sameSite: 'strict', secure: IS_PRODUCTION, path: '/' };
}

/** Cria uma sessão opaca. Só o hash SHA-256 do token fica no banco. */
async function createSession(res, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  await db.query('DELETE FROM sessions WHERE expires_at < $1', [Date.now()]);
  await db.query('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)',
    [sha256(token), userId, Date.now() + SESSION_TTL_MS]);
  res.cookie(COOKIE_NAME, token, { ...cookieOptions(), maxAge: SESSION_TTL_MS });
}

async function destroySession(req, res) {
  const token = req.cookies?.[COOKIE_NAME];
  if (token) await db.query('DELETE FROM sessions WHERE token_hash = $1', [sha256(token)]);
  res.clearCookie(COOKIE_NAME, cookieOptions());
}

/** Middleware global: popula req.user a partir do cookie de sessão (ou null). */
const loadUser = ah(async (req, res, next) => {
  req.user = null;
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return next();

  const row = await db.one(`
    SELECT u.id, u.name, u.email, u.username, u.role, u.level, s.expires_at, s.token_hash
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = $1
  `, [sha256(token)]);

  if (!row || Number(row.expires_at) < Date.now()) {
    if (row) await db.query('DELETE FROM sessions WHERE token_hash = $1', [row.token_hash]);
    res.clearCookie(COOKIE_NAME, cookieOptions());
    return next();
  }

  req.user = { id: row.id, name: row.name, email: row.email, username: row.username, role: row.role, level: row.level };
  next();
});

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

/**
 * Limitador simples em memória contra força bruta no login/cadastro.
 * Em serverless o contador vale por instância — é uma barreira básica, não absoluta.
 */
function rateLimit({ windowMs, max, keyFn }) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    if (hits.size > 5000) for (const [k, e] of hits) if (e.resetAt <= now) hits.delete(k);
    const key = keyFn(req);
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
  ah,
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
