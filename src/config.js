'use strict';

const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '..');
const IS_VERCEL = Boolean(process.env.VERCEL);

module.exports = {
  ROOT_DIR,
  IS_VERCEL,
  PORT: Number(process.env.PORT) || 3000,
  IS_PRODUCTION: process.env.NODE_ENV === 'production' || IS_VERCEL,

  // Banco: Postgres (Supabase) quando DATABASE_URL existe; senão PGlite local em data/pglite.
  DATABASE_URL: process.env.DATABASE_URL || '',
  PGLITE_DIR: process.env.PGLITE_DIR || path.join(ROOT_DIR, 'data', 'pglite'),

  // Arquivos: Supabase Storage quando SUPABASE_URL + chave existem; senão disco local.
  SUPABASE_URL: (process.env.SUPABASE_URL || '').replace(/\/+$/, ''),
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  SUPABASE_BUCKET: process.env.SUPABASE_BUCKET || 'materiais',
  UPLOAD_DIR: process.env.UPLOAD_DIR || path.join(ROOT_DIR, 'storage', 'uploads'),

  // O plano gratuito do Supabase aceita arquivos de até 50 MB.
  MAX_UPLOAD_MB: Number(process.env.MAX_UPLOAD_MB) || 50,
  SESSION_TTL_MS: 7 * 24 * 60 * 60 * 1000,
  BCRYPT_COST: 12,
};
