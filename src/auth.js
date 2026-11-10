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
    SELECT u.id, u.name, u.email, u.username, u.role, u.level, u.must_change_password, u.active, s.expires_at, s.token_hash
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = $1
  `, [sha256(token)]);

  // Sessão expirada ou aluno inativado pela escola: encerra a sessão.
  if (!row || Number(row.expires_at) < Date.now() || row.active === false) {
    if (row) await db.query('DELETE FROM sessions WHERE token_hash = $1', [row.token_hash]);
    res.clearCookie(COOKIE_NAME, cookieOptions());
    return next();
  }

  req.user = {
    id: row.id, name: row.name, email: row.email, username: row.username, role: row.role, level: row.level,
    mustChangePassword: Boolean(row.must_change_password),
  };
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

/** Controle Professor(a): professor(a) e administrador. Alunos nunca. */
function requireTeacher(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Faça login para continuar.', code: 'UNAUTHENTICATED' });
  if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso restrito ao Controle Professor(a).', code: 'FORBIDDEN' });
  }
  next();
}

/** Alunos precisam ter um nível antes de acessar trilhas e atividades (admin e professor não). */
function requirePlacement(req, res, next) {
  if (req.user.role === 'student' && !req.user.level) {
    return res.status(403).json({ error: 'Faça o teste de nivelamento primeiro.', code: 'PLACEMENT_REQUIRED' });
  }
  next();
}

/**
 * Limitador contra força bruta guardado no banco: vale para todas as instâncias
 * serverless ao mesmo tempo (um contador em memória "zera" a cada nova instância).
 * As chaves são guardadas como hash (não ficam IPs nem e-mails em texto no banco).
 *
 * limits: [{ name, windowMs, max, keyFn(req) }] — todos precisam estar dentro do limite.
 */
function rateLimit(limits) {
  return ah(async (req, res, next) => {
    const now = Date.now();
    let retryAfterMs = 0;
    for (const { name, windowMs, max, keyFn, subjectFn } of limits) {
      const key = sha256(`${name}|${keyFn(req)}`);
      const subject = subjectFn ? subjectHash(subjectFn(req)) : null;
      const row = await db.one(`
        INSERT INTO auth_attempts (key, count, reset_at, subject) VALUES ($1, 1, $2, $4)
        ON CONFLICT (key) DO UPDATE SET
          count    = CASE WHEN auth_attempts.reset_at <= $3 THEN 1  ELSE auth_attempts.count + 1 END,
          reset_at = CASE WHEN auth_attempts.reset_at <= $3 THEN $2 ELSE auth_attempts.reset_at END,
          subject  = COALESCE(EXCLUDED.subject, auth_attempts.subject)
        RETURNING count, reset_at
      `, [key, now + windowMs, now, subject]);
      if (row.count > max) retryAfterMs = Math.max(retryAfterMs, Number(row.reset_at) - now);
    }
    // Limpeza ocasional de contadores vencidos.
    if (Math.random() < 0.02) await db.query('DELETE FROM auth_attempts WHERE reset_at < $1', [now]);

    if (retryAfterMs > 0) {
      res.set('Retry-After', String(Math.ceil(retryAfterMs / 1000)));
      return res.status(429).json({ error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' });
    }
    next();
  });
}

/** Zera um contador (ex.: depois de um login bem-sucedido). */
async function resetRateLimit(name, keyValue) {
  await db.query('DELETE FROM auth_attempts WHERE key = $1', [sha256(`${name}|${keyValue}`)]);
}

const subjectHash = (identifier) => sha256(`subject|${String(identifier || '').trim().toLowerCase()}`);

/** Libera todos os bloqueios de login de uma conta (de qualquer IP). Usado ao redefinir a senha. */
async function clearAccountLimits(identifier) {
  await db.query('DELETE FROM auth_attempts WHERE subject = $1', [subjectHash(identifier)]);
}

module.exports = {
  clearAccountLimits,
  ah,
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
  loadUser,
  requireAuth,
  requireAdmin,
  requireTeacher,
  requirePlacement,
  rateLimit,
  resetRateLimit,
};
