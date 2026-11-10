'use strict';

const express = require('express');
const db = require('../db');
const {
  ah, hashPassword, verifyPassword, createSession, destroySession, rateLimit, resetRateLimit,
} = require('../auth');

const PasswordPolicy = require('../../public/js/password-policy');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const str = (v) => (typeof v === 'string' ? v.trim() : '');

const MIN = 60 * 1000;
const identifierOf = (req) => str(req.body?.identifier || req.body?.email).toLowerCase();

// Login: por IP + conta, por IP (muitas contas) e por conta (ataque distribuído de vários IPs).
const loginLimiter = rateLimit([
  { name: 'login-id', windowMs: 15 * MIN, max: 8, keyFn: (req) => `${req.ip}|${identifierOf(req)}` },
  { name: 'login-ip', windowMs: 15 * MIN, max: 40, keyFn: (req) => req.ip },
  { name: 'login-account', windowMs: 60 * MIN, max: 50, keyFn: identifierOf },
]);

// Cadastro: evita criação de contas em massa a partir do mesmo IP.
const registerLimiter = rateLimit([
  { name: 'register-ip', windowMs: 60 * MIN, max: 15, keyFn: (req) => req.ip },
]);

function publicUser(u) {
  return {
    id: u.id, name: u.name, email: u.email, username: u.username, role: u.role, level: u.level,
    mustChangePassword: Boolean(u.mustChangePassword ?? u.must_change_password),
  };
}

// Troca de senha: limita tentativas por conta.
const changeLimiter = rateLimit([
  { name: 'change-password', windowMs: 15 * MIN, max: 10, keyFn: (req) => `u${req.user?.id}` },
]);

router.post('/register', registerLimiter, ah(async (req, res) => {
  const name = str(req.body?.name);
  const email = str(req.body?.email).toLowerCase();
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const levelChoice = str(req.body?.level).toUpperCase();

  if (name.length < 2 || name.length > 80) return res.status(400).json({ error: 'Informe um nome entre 2 e 80 caracteres.' });
  if (!EMAIL_RE.test(email) || email.length > 160) return res.status(400).json({ error: 'Informe um e-mail válido.' });
  // Nível obrigatório: A1, A2, B2 ou "TEST" (não sei — vou fazer o teste de nivelamento).
  if (!['A1', 'A2', 'B2', 'TEST'].includes(levelChoice)) {
    return res.status(400).json({ error: 'Escolha o seu nível de inglês (ou "Não sei, quero fazer o teste").' });
  }
  const strength = PasswordPolicy.check(password, { name, email });
  if (!strength.ok) {
    const missing = strength.checks.filter((c) => !c.ok).map((c) => c.label.toLowerCase());
    return res.status(400).json({ error: `Senha fraca. Falta: ${missing.join('; ')}.`, code: 'WEAK_PASSWORD' });
  }
  const level = levelChoice === 'TEST' ? null : levelChoice;

  const exists = await db.one('SELECT 1 FROM users WHERE email = $1 OR username = $1', [email]);
  if (exists) return res.status(409).json({ error: 'Já existe uma conta com este e-mail.' });

  const passwordHash = await hashPassword(password);
  // O cadastro público sempre cria perfil "student"; não existe rota para virar admin.
  let user;
  try {
    user = await db.one(
      "INSERT INTO users (name, email, password_hash, role, level) VALUES ($1, $2, $3, 'student', $4) RETURNING *",
      [name, email, passwordHash, level],
    );
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Já existe uma conta com este e-mail.' });
    throw err;
  }

  await createSession(res, user.id);
  res.status(201).json({ user: publicUser(user) });
}));

router.post('/login', loginLimiter, ah(async (req, res) => {
  const identifier = str(req.body?.identifier).toLowerCase();
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!identifier || !password) return res.status(400).json({ error: 'Informe usuário/e-mail e senha.' });

  // Aceita e-mail (alunos) ou nome de usuário (administrador).
  const user = await db.one('SELECT * FROM users WHERE email = $1 OR username = $1', [identifier]);
  const ok = await verifyPassword(password, user?.password_hash);
  if (!user || !ok) return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
  // Só depois de conferir a senha, para não revelar a situação da conta a quem não a conhece.
  if (user.active === false) {
    return res.status(403).json({
      error: 'Seu acesso à Plataforma Novera está inativo. Fale com a escola ou com sua professora para reativar.',
      code: 'ACCOUNT_INACTIVE',
    });
  }

  await resetRateLimit('login-id', `${req.ip}|${identifier}`);
  await createSession(res, user.id);
  res.json({ user: publicUser(user) });
}));

router.post('/logout', ah(async (req, res) => {
  await destroySession(req, res);
  res.json({ ok: true });
}));

/**
 * Criar senha nova.
 *  - Com senha provisória (redefinida pela professora): basta a senha nova — o aluno acabou de
 *    entrar com a provisória.
 *  - Troca normal: exige a senha atual.
 * Encerra as outras sessões do usuário e mantém a atual.
 */
router.post('/change-password', changeLimiter, ah(async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Faça login para continuar.', code: 'UNAUTHENTICATED' });
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const current = typeof req.body?.current === 'string' ? req.body.current : '';
  const row = await db.one('SELECT password_hash, must_change_password FROM users WHERE id = $1', [req.user.id]);
  if (!row) return res.status(401).json({ error: 'Faça login para continuar.', code: 'UNAUTHENTICATED' });

  if (!row.must_change_password && !(await verifyPassword(current, row.password_hash))) {
    return res.status(400).json({ error: 'A senha atual está incorreta.', code: 'WRONG_PASSWORD' });
  }
  const strength = PasswordPolicy.check(password, { name: req.user.name, email: req.user.email });
  if (!strength.ok) {
    const missing = strength.checks.filter((c) => !c.ok).map((c) => c.label.toLowerCase());
    return res.status(400).json({ error: `Senha fraca. Falta: ${missing.join('; ')}.`, code: 'WEAK_PASSWORD' });
  }
  if (await verifyPassword(password, row.password_hash)) {
    return res.status(400).json({ error: 'A senha nova precisa ser diferente da atual.', code: 'SAME_PASSWORD' });
  }

  const hash = await hashPassword(password);
  await db.query('UPDATE users SET password_hash = $1, must_change_password = false WHERE id = $2', [hash, req.user.id]);
  const token = req.cookies?.novera_session;
  const keep = token ? require('node:crypto').createHash('sha256').update(token).digest('hex') : '';
  await db.query('DELETE FROM sessions WHERE user_id = $1 AND token_hash <> $2', [req.user.id, keep]);
  res.json({ ok: true, user: publicUser({ ...req.user, mustChangePassword: false }) });
}));

// Retorna { user: null } quando não há sessão (evita 401 "barulhento" na tela de login).
router.get('/me', (req, res) => {
  res.json({ user: req.user ? publicUser(req.user) : null });
});

module.exports = router;
