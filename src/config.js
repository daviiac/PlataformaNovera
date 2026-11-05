'use strict';

const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '..');

module.exports = {
  ROOT_DIR,
  PORT: Number(process.env.PORT) || 3000,
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
  DB_PATH: process.env.DB_PATH || path.join(ROOT_DIR, 'data', 'novera.db'),
  UPLOAD_DIR: process.env.UPLOAD_DIR || path.join(ROOT_DIR, 'storage', 'uploads'),
  MAX_UPLOAD_MB: Number(process.env.MAX_UPLOAD_MB) || 200,
  SESSION_TTL_MS: 7 * 24 * 60 * 60 * 1000,
  BCRYPT_COST: 12,
};
