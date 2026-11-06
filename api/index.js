'use strict';

// Ponto de entrada da função serverless na Vercel: todas as rotas dinâmicas
// (API, /admin e páginas não estáticas) chegam aqui pelo rewrite do vercel.json.
module.exports = require('../src/app');
