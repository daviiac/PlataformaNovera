'use strict';

/**
 * Inicialização do banco e do armazenamento:
 *  - cria as tabelas (se ainda não existirem);
 *  - cria o usuário administrador (senha gravada apenas como hash bcrypt);
 *  - cria os módulos padrão das trilhas A1, A2 e B2 (se ainda não houver módulos);
 *  - cria o bucket privado de materiais no Supabase Storage (se configurado).
 *
 * Usa o mesmo .env do servidor. Para preparar o Supabase de produção, rode no seu
 * computador com DATABASE_URL, SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY do projeto.
 *
 *   npm run seed                 -> cria o que faltar
 *   npm run seed:reset-admin     -> redefine a senha do admin a partir do .env
 */
const db = require('../src/db');
const { hashPassword } = require('../src/auth');
const { DEFAULT_MODULES } = require('../src/tracks');
const { storage } = require('../src/storage');

/** Cria (ou, com reset, redefine) um usuário da equipe: 'admin' ou 'teacher'. */
async function ensureStaff({ username, password, name, role, reset = false }) {
  if (!['admin', 'teacher'].includes(role)) throw new Error('Perfil inválido.');
  const uname = username.trim().toLowerCase();
  const existing = await db.one('SELECT id FROM users WHERE username = $1', [uname]);

  if (existing) {
    if (!reset) return { created: false, updated: false };
    await db.query('UPDATE users SET password_hash = $1, role = $2, name = $3 WHERE id = $4',
      [await hashPassword(password), role, name, existing.id]);
    await db.query('DELETE FROM sessions WHERE user_id = $1', [existing.id]);
    return { created: false, updated: true };
  }

  await db.query('INSERT INTO users (name, username, password_hash, role) VALUES ($1, $2, $3, $4)',
    [name, uname, await hashPassword(password), role]);
  return { created: true, updated: false };
}

async function ensureAdmin({ username, password, name, reset = false }) {
  if (!username || !password) {
    throw new Error('Defina ADMIN_USERNAME e ADMIN_PASSWORD no arquivo .env antes de rodar o seed.');
  }
  return ensureStaff({ username, password, name, role: 'admin', reset });
}

/** Login do Controle Professor(a): TEACHER_USERNAME / TEACHER_PASSWORD no .env (opcional). */
async function ensureTeacher({ username, password, name, reset = false }) {
  if (!username || !password) return null;
  return ensureStaff({ username, password, name: name || 'Professor(a)', role: 'teacher', reset });
}

async function ensureDefaultModules() {
  const { n } = await db.one('SELECT COUNT(*)::int AS n FROM modules');
  if (n > 0) return 0;
  let count = 0;
  for (const [track, modules] of Object.entries(DEFAULT_MODULES)) {
    for (const [i, [title, description]] of modules.entries()) {
      await db.query('INSERT INTO modules (track, title, description, position) VALUES ($1, $2, $3, $4)',
        [track, title, description, i + 1]);
      count += 1;
    }
  }
  return count;
}

async function main() {
  const reset = process.argv.includes('--reset-admin');
  console.log(`Banco: ${require('../src/config').DATABASE_URL ? 'Postgres (DATABASE_URL)' : 'PGlite local (data/pglite)'} · Arquivos: ${storage.name}`);

  const admin = await ensureAdmin({
    username: process.env.ADMIN_USERNAME,
    password: process.env.ADMIN_PASSWORD,
    name: process.env.ADMIN_NAME || 'Administrador',
    reset,
  });
  const teacher = await ensureTeacher({
    username: process.env.TEACHER_USERNAME,
    password: process.env.TEACHER_PASSWORD,
    name: process.env.TEACHER_NAME,
    reset,
  });
  const modules = await ensureDefaultModules();
  const bucketCreated = await storage.ensureBucket();

  if (admin.created) console.log(`✔ Administrador "${process.env.ADMIN_USERNAME}" criado (senha armazenada com bcrypt).`);
  else if (admin.updated) console.log(`✔ Senha do administrador "${process.env.ADMIN_USERNAME}" redefinida.`);
  else console.log(`• Administrador "${process.env.ADMIN_USERNAME}" já existe — nada alterado.`);
  if (teacher?.created) console.log(`✔ Professor(a) "${process.env.TEACHER_USERNAME}" criado (senha armazenada com bcrypt).`);
  else if (teacher?.updated) console.log(`✔ Senha do professor(a) "${process.env.TEACHER_USERNAME}" redefinida.`);
  else if (teacher) console.log(`• Professor(a) "${process.env.TEACHER_USERNAME}" já existe — nada alterado.`);
  console.log(modules ? `✔ ${modules} módulos padrão criados.` : '• Módulos já existentes — nada alterado.');
  if (storage.name === 'supabase') {
    console.log(bucketCreated ? '✔ Bucket privado de materiais criado no Supabase Storage.' : '• Bucket de materiais já existe.');
  }
}

if (require.main === module) {
  main()
    .then(() => db.close())
    .catch(async (err) => {
      console.error('✖', err.message);
      await db.close().catch(() => {});
      process.exit(1);
    });
}

module.exports = { ensureAdmin, ensureTeacher, ensureDefaultModules };
