'use strict';

const path = require('node:path');
const express = require('express');
const cookieParser = require('cookie-parser');
const config = require('./config');
const { ROOT_DIR, IS_VERCEL } = config;
const { loadUser } = require('./auth');
const { storage } = require('./storage');

const app = express();
app.disable('x-powered-by');
// Na Vercel (ou atrás de outro proxy) o IP real do cliente vem em X-Forwarded-For.
if (IS_VERCEL || process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);

// Cabeçalhos de segurança. Em produção os arquivos vêm de URLs assinadas do Supabase,
// então o domínio do Storage é liberado para upload (connect), mídia e PDF (frame).
const storageOrigin = storage.origin ? ` ${storage.origin}` : '';
const CSP = [
  "default-src 'self'",
  "style-src 'self' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  `img-src 'self' data:${storageOrigin}`,
  `media-src 'self'${storageOrigin}`,
  `frame-src 'self'${storageOrigin}`,
  `connect-src 'self'${storageOrigin}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join('; ');

app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'same-origin',
    'Content-Security-Policy': CSP,
  });
  next();
});

app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use(loadUser);

// ---------- Diagnóstico ----------
// Mostra só se cada configuração existe e se o banco responde (nunca valores ou segredos).
app.get('/api/health', async (req, res) => {
  const db = require('./db');
  let database = 'ok';
  try {
    await db.query('SELECT 1');
  } catch (err) {
    database = `erro: ${err.code ? `[${err.code}] ` : ''}${String(err.message).replace(/\w+:\/\/\S+/g, '<url>').slice(0, 200)}`;
  }
  res.set('Cache-Control', 'no-store');
  res.status(database === 'ok' ? 200 : 503).json({
    database,
    env: {
      DATABASE_URL: Boolean(config.DATABASE_URL),
      SUPABASE_URL: Boolean(config.SUPABASE_URL),
      SUPABASE_SERVICE_ROLE_KEY: Boolean(config.SUPABASE_SERVICE_ROLE_KEY),
      SUPABASE_PUBLISHABLE_KEY: Boolean(config.SUPABASE_PUBLISHABLE_KEY),
      SUPABASE_BUCKET: config.SUPABASE_BUCKET,
    },
    project: (config.SUPABASE_URL.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/) || [])[1] || null,
    storage: storage.name,
    region: process.env.VERCEL_REGION || null,
  });
});

// ---------- API ----------
app.use('/api/auth', require('./routes/auth'));
app.use('/api/placement', require('./routes/placement'));
app.use('/api/tracks', require('./routes/tracks'));
app.use('/api/materials', require('./routes/materials'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api', (req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));

// ---------- Páginas ----------
// O painel fica fora de /public e só é entregue a quem é admin no servidor.
const adminPage = (file) => (req, res) => {
  if (!req.user) return res.redirect('/');
  if (req.user.role !== 'admin') return res.redirect('/trilha');
  res.set('Cache-Control', 'no-store');
  res.sendFile(path.join(ROOT_DIR, 'views', file));
};
app.get(['/admin', '/admin.html'], adminPage('admin.html'));
app.get('/admin/admin.js', adminPage('admin.js'));

// Na Vercel os arquivos de /public saem direto da CDN; localmente o Express os serve.
app.use(express.static(path.join(ROOT_DIR, 'public'), { extensions: ['html'] }));
app.use((req, res) => res.status(404).sendFile(path.join(ROOT_DIR, 'public', 'index.html')));

// ---------- Erros ----------
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido.' });
  if (err.status && err.status < 500) return res.status(err.status).json({ error: err.message });
  console.error(err);
  if (res.headersSent) return;
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

module.exports = app;
