'use strict';

/**
 * Inicialização do banco:
 *  - cria o usuário administrador (senha gravada apenas como hash bcrypt);
 *  - cria os módulos padrão das trilhas A1, A2 e B2 (se ainda não houver módulos).
 *
 * As credenciais vêm de variáveis de ambiente (arquivo .env):
 *   ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_NAME
 *
 * Uso:
 *   npm run seed                 -> cria o admin se não existir
 *   npm run seed:reset-admin     -> redefine a senha do admin a partir do .env
 */
const db = require('../src/db');
const { hashPassword } = require('../src/auth');
const { DEFAULT_MODULES } = require('../src/tracks');

async function ensureAdmin({ username, password, name, reset = false }) {
  if (!username || !password) {
    throw new Error('Defina ADMIN_USERNAME e ADMIN_PASSWORD no arquivo .env antes de rodar o seed.');
  }
  const uname = username.trim().toLowerCase();
  const existing = db.prepare('SELECT id, role FROM users WHERE username = ?').get(uname);

  if (existing) {
    if (!reset) return { created: false, updated: false };
    db.prepare("UPDATE users SET password_hash = ?, role = 'admin', name = ? WHERE id = ?")
      .run(await hashPassword(password), name, existing.id);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(existing.id);
    return { created: false, updated: true };
  }

  db.prepare("INSERT INTO users (name, username, password_hash, role) VALUES (?, ?, ?, 'admin')")
    .run(name, uname, await hashPassword(password));
  return { created: true, updated: false };
}

function ensureDefaultModules() {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM modules').get();
  if (n > 0) return 0;
  const insert = db.prepare('INSERT INTO modules (track, title, description, position) VALUES (?, ?, ?, ?)');
  let count = 0;
  for (const [track, modules] of Object.entries(DEFAULT_MODULES)) {
    modules.forEach(([title, description], i) => {
      insert.run(track, title, description, i + 1);
      count += 1;
    });
  }
  return count;
}

async function main() {
  const reset = process.argv.includes('--reset-admin');
  const admin = await ensureAdmin({
    username: process.env.ADMIN_USERNAME,
    password: process.env.ADMIN_PASSWORD,
    name: process.env.ADMIN_NAME || 'Administrador',
    reset,
  });
  const modules = ensureDefaultModules();

  if (admin.created) console.log(`✔ Administrador "${process.env.ADMIN_USERNAME}" criado (senha armazenada com bcrypt).`);
  else if (admin.updated) console.log(`✔ Senha do administrador "${process.env.ADMIN_USERNAME}" redefinida.`);
  else console.log(`• Administrador "${process.env.ADMIN_USERNAME}" já existe — nada alterado.`);
  console.log(modules ? `✔ ${modules} módulos padrão criados.` : '• Módulos já existentes — nada alterado.');
}

if (require.main === module) {
  main().catch((err) => {
    console.error('✖', err.message);
    process.exit(1);
  });
}

module.exports = { ensureAdmin, ensureDefaultModules };
