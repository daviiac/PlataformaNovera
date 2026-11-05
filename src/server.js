'use strict';

const path = require('node:path');
const express = require('express');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const { PORT, ROOT_DIR, MAX_UPLOAD_MB } = require('./config');
require('./db');
const { loadUser } = require('./auth');

const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);

// Cabeçalhos de segurança básicos.
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'same-origin',
    'Content-Security-Policy': [
      "default-src 'self'",
      "style-src 'self' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data:",
      "media-src 'self'",
      "frame-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
    ].join('; '),
  });
  next();
});

app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use(loadUser);

// ---------- API ----------
app.use('/api/auth', require('./routes/auth'));
app.use('/api/placement', require('./routes/placement'));
app.use('/api/tracks', require('./routes/tracks'));
app.use('/api/materials', require('./routes/materials'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api', (req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));

// ---------- Páginas ----------
// A página do painel fica fora de /public e só é entregue a quem é admin no servidor.
const adminPage = (file) => (req, res) => {
  if (!req.user) return res.redirect('/');
  if (req.user.role !== 'admin') return res.redirect('/trilha');
  res.sendFile(path.join(ROOT_DIR, 'views', file));
};
app.get(['/admin', '/admin.html'], adminPage('admin.html'));
app.get('/admin/admin.js', adminPage('admin.js'));

app.use(express.static(path.join(ROOT_DIR, 'public'), { extensions: ['html'] }));
app.use((req, res) => res.status(404).sendFile(path.join(ROOT_DIR, 'public', 'index.html')));

// ---------- Erros ----------
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE'
      ? `Arquivo maior que o limite de ${MAX_UPLOAD_MB} MB.`
      : `Erro no upload: ${err.message}`;
    return res.status(400).json({ error: msg });
  }
  if (err.status && err.status < 500) return res.status(err.status).json({ error: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido.' });
  console.error(err);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`Plataforma Novera rodando em http://localhost:${PORT}`));
}

module.exports = app;
