'use strict';

// Servidor local (npm start). Na Vercel quem roda o app é api/index.js.
const app = require('./app');
const db = require('./db');
const { PORT } = require('./config');
const { storage } = require('./storage');

db.ready()
  .then(() => {
    const server = app.listen(PORT, () => {
      console.log(`Plataforma Novera rodando em http://localhost:${PORT}`);
      console.log(`Banco: ${require('./config').DATABASE_URL ? 'Postgres (DATABASE_URL)' : 'PGlite local (data/pglite)'} · Arquivos: ${storage.name}`);
    });
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`A porta ${PORT} já está em uso. Feche o outro servidor ou defina outra porta no .env (PORT=3001).`);
        process.exit(1);
      }
      throw err;
    });
  })
  .catch((err) => {
    console.error('Não foi possível conectar ao banco de dados:', err.message);
    process.exit(1);
  });
