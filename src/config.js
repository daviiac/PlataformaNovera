'use strict';

const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '..');
const IS_VERCEL = Boolean(process.env.VERCEL);

/** Primeiro valor não vazio entre os nomes aceitos para a mesma configuração. */
const env = (...names) => {
  for (const n of names) {
    const v = (process.env[n] || '').trim();
    if (v) return v;
  }
  return '';
};

module.exports = {
  ROOT_DIR,
  IS_VERCEL,
  PORT: Number(process.env.PORT) || 3000,
  IS_PRODUCTION: process.env.NODE_ENV === 'production' || IS_VERCEL,

  // Banco: Postgres (Supabase) quando há URL de conexão; senão PGlite local em data/pglite.
  // POSTGRES_URL é o nome criado pela integração Supabase ↔ Vercel.
  DATABASE_URL: env('DATABASE_URL', 'POSTGRES_URL'),
  PGLITE_DIR: process.env.PGLITE_DIR || path.join(ROOT_DIR, 'data', 'pglite'),

  // Arquivos: Supabase Storage quando URL + chave secreta existem; senão disco local.
  // A chave publishable (pública) NÃO serve aqui: o bucket é privado e as tabelas têm RLS.
  SUPABASE_URL: env('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL').replace(/\/+$/, ''),
  SUPABASE_SERVICE_ROLE_KEY: env('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY'),
  SUPABASE_PUBLISHABLE_KEY: env('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_PUBLISHABLE_KEY'),
  SUPABASE_BUCKET: process.env.SUPABASE_BUCKET || 'materiais',
  UPLOAD_DIR: process.env.UPLOAD_DIR || path.join(ROOT_DIR, 'storage', 'uploads'),

  // O plano gratuito do Supabase aceita arquivos de até 50 MB.
  MAX_UPLOAD_MB: Number(process.env.MAX_UPLOAD_MB) || 50,
  SESSION_TTL_MS: 7 * 24 * 60 * 60 * 1000,
  BCRYPT_COST: 12,
};
