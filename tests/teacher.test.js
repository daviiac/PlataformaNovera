'use strict';

// Testes: cadastro com nível + senha forte, perfil do professor e Controle Professor(a).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'novera-teacher-'));
process.env.PGLITE_DIR = 'memory';
process.env.UPLOAD_DIR = path.join(tmp, 'uploads');
for (const k of ['DATABASE_URL', 'POSTGRES_URL', 'SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY', 'VERCEL']) delete process.env[k];

const app = require('../src/app');
const db = require('../src/db');
const { ensureAdmin, ensureTeacher, ensureDefaultModules } = require('../scripts/seed');
const { QUESTIONS } = require('../src/placement');
const PasswordPolicy = require('../public/js/password-policy');

// Credenciais usadas só no banco temporário dos testes.
const ADMIN = { user: 'admin-teste', pass: 'Admin#Teste2026' };
const TEACHER = { user: 'prof-teste', pass: 'Prof#Teste2026' };
const STRONG = 'Lago#Verde2026';
let server;
let base;

function client() {
  let cookie = '';
  return async (method, url, { json } = {}) => {
    const headers = {};
    if (cookie) headers.cookie = cookie;
    let body;
    if (json) { headers['content-type'] = 'application/json'; body = JSON.stringify(json); }
    const res = await fetch(base + url, { method, headers, body, redirect: 'manual' });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch { data = text; }
    return { status: res.status, data, headers: res.headers };
  };
}

async function login(user, pass) {
  const c = client();
  const r = await c('POST', '/api/auth/login', { json: { identifier: user, password: pass } });
  assert.equal(r.status, 200, `login ${user}`);
  return c;
}

before(async () => {
  await ensureAdmin({ username: ADMIN.user, password: ADMIN.pass, name: 'Admin' });
  await ensureTeacher({ username: TEACHER.user, password: TEACHER.pass, name: 'Prof Teste' });
  await ensureDefaultModules();
  await new Promise((r) => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server.close();
  await db.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('professora redefine a senha: senha provisória e troca obrigatória no próximo login', async () => {
  const email = 'esqueci@exemplo.com';
  const s = client();
  assert.equal((await s('POST', '/api/auth/register', { json: { name: 'Clara Nunes', email, password: STRONG, level: 'A1' } })).status, 201);
  const sid = (await s('GET', '/api/auth/me')).data.user.id;

  // Aluno não pode redefinir senha de ninguém.
  assert.equal((await s('POST', `/api/teacher/students/${sid}/reset-password`)).status, 403);

  const t = await login(TEACHER.user, TEACHER.pass);
  const r = await t('POST', `/api/teacher/students/${sid}/reset-password`);
  assert.equal(r.status, 200);
  const temp = r.data.tempPassword;
  assert.ok(PasswordPolicy.check(temp, { name: 'Clara Nunes', email }).ok, 'provisória passa nas regras');

  // Sessão antiga encerrada e senha antiga deixa de funcionar.
  assert.equal((await s('GET', '/api/auth/me')).data.user, null);
  assert.equal((await client()('POST', '/api/auth/login', { json: { identifier: email, password: STRONG } })).status, 401);

  // Entra com a provisória: só pode trocar a senha.
  const c = await login(email, temp);
  assert.equal((await c('GET', '/api/auth/me')).data.user.mustChangePassword, true);
  const blocked = await c('GET', '/api/tracks');
  assert.equal(blocked.status, 403);
  assert.equal(blocked.data.code, 'PASSWORD_CHANGE_REQUIRED');
  assert.equal((await c('POST', '/api/auth/change-password', { json: { password: 'fraca' } })).data.code, 'WEAK_PASSWORD');
  assert.equal((await c('POST', '/api/auth/change-password', { json: { password: temp } })).data.code, 'SAME_PASSWORD');
  const ok = await c('POST', '/api/auth/change-password', { json: { password: 'Nova#Senha77' } });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.user.mustChangePassword, false);

  // Acesso liberado e a nova senha funciona; troca normal exige a senha atual.
  assert.equal((await c('GET', '/api/tracks')).status, 200);
  assert.equal((await client()('POST', '/api/auth/login', { json: { identifier: email, password: 'Nova#Senha77' } })).status, 200);
  assert.equal((await c('POST', '/api/auth/change-password', { json: { password: 'Outra#Senha88' } })).data.code, 'WRONG_PASSWORD');

  // Professor(a) não redefine senha de equipe.
  const adminId = (await db.one("SELECT id FROM users WHERE role = 'admin' LIMIT 1")).id;
  assert.equal((await t('POST', `/api/teacher/students/${adminId}/reset-password`)).status, 404);
});

test('política de senha: aponta o que falta e aceita senha forte', () => {
  const weak = PasswordPolicy.check('abc', {});
  assert.equal(weak.ok, false);
  assert.equal(weak.strength, 'fraca');
  assert.equal(PasswordPolicy.check('senha123456', {}).ok, false);
  assert.ok(!PasswordPolicy.check('Abc#1', {}).checks.some((c) => c.id === 'length' || c.id === 'common'), 'sem regras de tamanho/óbvio');
  assert.equal(PasswordPolicy.check('Abc#1', {}).ok, true);
  assert.equal(PasswordPolicy.check('Mariana#Sol2026', { name: 'Mariana Souza' }).ok, false, 'contém o nome');
  assert.equal(PasswordPolicy.check('Joaozinho#99x', { email: 'joaozinho@x.com' }).ok, false, 'contém o e-mail');
  assert.equal(PasswordPolicy.check('Lago#Verde2026', { name: 'Ana', email: 'ana@x.com' }).ok, true);
  assert.equal(PasswordPolicy.check('Lago#Verde2026', {}).strength, 'forte');
});

test('cadastro: todos os campos obrigatórios, nível e senha forte', async () => {
  const base = { name: 'Bruna Lima', email: 'bruna@exemplo.com', password: STRONG, level: 'A2' };
  assert.equal((await client()('POST', '/api/auth/register', { json: { ...base, level: '' } })).status, 400);
  assert.equal((await client()('POST', '/api/auth/register', { json: { ...base, level: 'C1' } })).status, 400);
  const weak = await client()('POST', '/api/auth/register', { json: { ...base, password: 'bruna2026' } });
  assert.equal(weak.status, 400);
  assert.equal(weak.data.code, 'WEAK_PASSWORD');
  assert.match(weak.data.error, /maiúscula/);
  assert.equal((await client()('POST', '/api/auth/register', { json: { ...base, name: '' } })).status, 400);

  // Nível informado no cadastro já libera trilhas e atividades.
  const c = client();
  const ok = await c('POST', '/api/auth/register', { json: base });
  assert.equal(ok.status, 201);
  assert.equal(ok.data.user.level, 'A2');
  assert.equal((await c('GET', '/api/tracks/A2')).status, 200);

  // "Não sei" → sem nível, vai para o nivelamento.
  const d = client();
  const t = await d('POST', '/api/auth/register', { json: { ...base, email: 'nao-sei@exemplo.com', level: 'TEST' } });
  assert.equal(t.data.user.level, null);
  assert.equal((await d('GET', '/api/tracks/A1')).data.code, 'PLACEMENT_REQUIRED');
});

test('Controle Professor(a): só o login do professor acessa', async () => {
  assert.equal((await client()('GET', '/api/teacher/overview')).status, 401);

  const s = client();
  await s('POST', '/api/auth/register', { json: { name: 'Caio Rocha', email: 'caio@exemplo.com', password: STRONG, level: 'A1' } });
  assert.equal((await s('GET', '/api/teacher/overview')).status, 403);
  assert.equal((await s('GET', '/professor')).status, 302);
  assert.equal((await s('GET', '/professor/professor.js')).status, 302);

  // O administrador também vê o Controle Professor(a) (além do painel admin).
  const a = await login(ADMIN.user, ADMIN.pass);
  assert.equal((await a('GET', '/api/teacher/overview')).status, 200);
  assert.equal((await a('GET', '/professor')).status, 200);
  assert.equal((await a('GET', '/admin')).status, 200);

  const t = await login(TEACHER.user, TEACHER.pass);
  assert.equal((await t('GET', '/api/auth/me')).data.user.role, 'teacher');
  assert.equal((await t('GET', '/api/teacher/overview')).status, 200);
  assert.equal((await t('GET', '/professor')).status, 200);
  assert.equal((await t('GET', '/professor/professor.js')).status, 200);
  // O professor não acessa o painel admin.
  assert.equal((await t('GET', '/admin')).status, 302);
  // O professor navega pelas atividades, mas não mexe no painel admin.
  assert.equal((await t('GET', '/api/activities/types')).status, 200);
  assert.equal((await t('GET', '/api/admin/students')).status, 403);
  assert.equal((await t('POST', '/api/admin/modules', { json: { track: 'A1', title: 'X' } })).status, 403);
});

test('Controle Professor(a): acertos e erros por aluno e por categoria', async () => {
  const s = client();
  await s('POST', '/api/auth/register', { json: { name: 'Duda Alves', email: 'duda@exemplo.com', password: STRONG, level: 'TEST' } });
  // Nivelamento: acerta tudo de A1, erra o resto.
  const answers = Object.fromEntries(QUESTIONS.map((q) => [q.id, q.band === 'A1' ? q.answer : (q.answer + 1) % q.options.length]));
  await s('POST', '/api/placement/submit', { json: { answers } });
  await s('POST', '/api/activities/b-listen-at-the-bakery/attempts', { json: { score: 4, total: 6 } });
  await s('POST', '/api/activities/b-listen-new-neighbor/attempts', { json: { score: 6, total: 6 } });
  await s('POST', '/api/activities/b-dictation-my-routine/attempts', { json: { score: 5, total: 8 } });
  await s('POST', '/api/activities/b-grammar-verb-to-be/attempts', { json: { score: 1, total: 1 } }); // lição: sem nota

  const t = await login(TEACHER.user, TEACHER.pass);
  const ov = await t('GET', '/api/teacher/overview');
  const duda = ov.data.students.find((x) => x.email === 'duda@exemplo.com');
  assert.ok(duda, 'aluno aparece na lista');
  assert.deepEqual(
    { a: duda.categories.listen.attempts, h: duda.categories.listen.hits, m: duda.categories.listen.misses },
    { a: 2, h: 10, m: 2 },
  );
  assert.deepEqual({ h: duda.categories.dictation.hits, m: duda.categories.dictation.misses }, { h: 5, m: 3 });
  assert.equal(duda.categories.placement.hits, 5, 'nivelamento: 5 pontos (A1)');
  assert.equal(duda.categories.grammar_lesson, undefined, 'lição não entra como acerto/erro');
  assert.equal(duda.done, 1);
  assert.equal(duda.hits, 15);
  assert.equal(duda.misses, 5);
  assert.ok(ov.data.students.every((x) => !x.password_hash), 'nunca expõe hash de senha');
  assert.ok(!ov.data.students.some((x) => x.role === 'admin' || x.role === 'teacher'));

  const det = await t('GET', `/api/teacher/students/${duda.id}`);
  assert.equal(det.status, 200);
  const listen = det.data.attempts.filter((r) => r.category === 'listen');
  assert.equal(listen.length, 2);
  assert.ok(listen.some((r) => r.title === 'At the Bakery' && r.hits === 4 && r.misses === 2));
  assert.ok(det.data.attempts.some((r) => r.category === 'placement'));
  assert.equal((await t('GET', '/api/teacher/students/999999')).status, 404);
});

test('migração: banco antigo passa a aceitar o perfil professor', async () => {
  const { PGlite } = require('@electric-sql/pglite');
  const { STATEMENTS } = require('../src/db');
  const pg = new PGlite();
  await pg.exec(`CREATE TABLE users (
    id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE, username TEXT UNIQUE,
    password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
    level TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), CHECK (email IS NOT NULL OR username IS NOT NULL))`);
  await assert.rejects(pg.query("INSERT INTO users (name, username, password_hash, role) VALUES ('x', 'x', 'h', 'teacher')"));
  for (const s of STATEMENTS) await pg.query(s);
  for (const s of STATEMENTS) await pg.query(s); // idempotente
  await pg.query("INSERT INTO users (name, username, password_hash, role) VALUES ('p', 'p', 'h', 'teacher')");
  await assert.rejects(pg.query("INSERT INTO users (name, username, password_hash, role) VALUES ('h', 'h', 'h', 'hacker')"));
  await pg.close();
});

test('Controle Professor(a): inativar, reativar e excluir cadastro do aluno', async () => {
  const s = client();
  const reg = await s('POST', '/api/auth/register', { json: { name: 'Gabi Nunes', email: 'gabi@exemplo.com', password: STRONG, level: 'A1' } });
  assert.equal(reg.status, 201);
  const sid = reg.data.user.id;
  await s('POST', '/api/activities/b-listen-at-the-bakery/attempts', { json: { score: 3, total: 6 } });
  assert.equal((await s('GET', '/api/tracks')).status, 200);

  const t = await login(TEACHER.user, TEACHER.pass);
  assert.equal((await t('PATCH', `/api/teacher/students/${sid}/active`, { json: {} })).status, 400);

  // Inativar: desconecta na hora, não entra mais e aparece como inativo para a professora.
  const off = await t('PATCH', `/api/teacher/students/${sid}/active`, { json: { active: false } });
  assert.equal(off.status, 200);
  assert.equal(off.data.active, false);
  assert.ok(off.data.deactivatedAt);
  assert.equal((await s('GET', '/api/tracks')).status, 401, 'sessão aberta encerrada');
  assert.equal((await s('GET', '/api/auth/me')).data.user, null);
  const blocked = await client()('POST', '/api/auth/login', { json: { identifier: 'gabi@exemplo.com', password: STRONG } });
  assert.equal(blocked.status, 403);
  assert.equal(blocked.data.code, 'ACCOUNT_INACTIVE');
  // Senha errada continua dando a mensagem genérica (não revela a situação da conta).
  const wrong = await client()('POST', '/api/auth/login', { json: { identifier: 'gabi@exemplo.com', password: 'Errada#2026x' } });
  assert.equal(wrong.status, 401);
  const listed = (await t('GET', '/api/teacher/overview')).data.students.find((x) => x.id === sid);
  assert.equal(listed.active, false);
  assert.equal(listed.hits, 3, 'histórico mantido');

  // Reativar: entra de novo com a mesma senha.
  const on = await t('PATCH', `/api/teacher/students/${sid}/active`, { json: { active: true } });
  assert.equal(on.data.active, true);
  assert.equal(on.data.deactivatedAt, null);
  const back = await login('gabi@exemplo.com', STRONG);
  assert.equal((await back('GET', '/api/tracks')).status, 200);

  // Professor(a) não inativa nem exclui outra pessoa da equipe.
  const staff = await db.one("SELECT id FROM users WHERE username = $1", [ADMIN.user]);
  assert.equal((await t('PATCH', `/api/teacher/students/${staff.id}/active`, { json: { active: false } })).status, 404);
  assert.equal((await t('DELETE', `/api/teacher/students/${staff.id}`)).status, 404);
  // Aluno não usa essas rotas.
  assert.equal((await back('DELETE', `/api/teacher/students/${sid}`)).status, 403);

  // Excluir: conta e histórico somem; o e-mail fica livre para um novo cadastro.
  const del = await t('DELETE', `/api/teacher/students/${sid}`);
  assert.equal(del.status, 200);
  assert.equal((await back('GET', '/api/tracks')).status, 401);
  assert.equal((await t('GET', `/api/teacher/students/${sid}`)).status, 404);
  assert.equal((await db.query('SELECT 1 FROM activity_attempts WHERE user_id = $1', [sid])).length, 0);
  assert.equal((await db.query('SELECT 1 FROM level_changes WHERE user_id = $1', [sid])).length, 0);
  assert.equal((await t('DELETE', `/api/teacher/students/${sid}`)).status, 404);
  const again = await client()('POST', '/api/auth/register', { json: { name: 'Gabi Nunes', email: 'gabi@exemplo.com', password: STRONG, level: 'A1' } });
  assert.equal(again.status, 201);
});

test('senha provisória: aceita espaço ou quebra de linha copiados junto; senha normal continua exata', async () => {
  const s = client();
  const reg = await s('POST', '/api/auth/register', { json: { name: 'Caio Prado', email: 'caio.temp@exemplo.com', password: STRONG, level: 'A1' } });
  assert.equal(reg.status, 201);
  const anon = () => client();
  // Senha normal: espaço a mais continua sendo senha errada.
  assert.equal((await anon()('POST', '/api/auth/login', { json: { identifier: 'caio.temp@exemplo.com', password: `${STRONG} ` } })).status, 401);

  const t = await login(TEACHER.user, TEACHER.pass);
  const r1 = await t('POST', `/api/teacher/students/${reg.data.user.id}/reset-password`);
  const r2 = await t('POST', `/api/teacher/students/${reg.data.user.id}/reset-password`);
  const temp = r2.data.tempPassword;
  // Só a senha mais nova vale.
  assert.equal((await anon()('POST', '/api/auth/login', { json: { identifier: 'caio.temp@exemplo.com', password: r1.data.tempPassword } })).status, 401);
  for (const pw of [`${temp} `, `${temp}\n`, ` ${temp}`, `\t${temp}\r\n`]) {
    const r = await anon()('POST', '/api/auth/login', { json: { identifier: 'caio.temp@exemplo.com', password: pw } });
    assert.equal(r.status, 200, JSON.stringify(pw));
    assert.equal(r.data.user.mustChangePassword, true);
  }
  // Maiúsculas/minúsculas continuam importando.
  assert.equal((await anon()('POST', '/api/auth/login', { json: { identifier: 'caio.temp@exemplo.com', password: temp.toLowerCase() } })).status, 401);
});

test('redefinir senha libera o bloqueio por tentativas; depois da troca entra só com a senha nova', async () => {
  const email = 'rita.bloqueio@exemplo.com';
  const s = client();
  const reg = await s('POST', '/api/auth/register', { json: { name: 'Rita Lopes', email, password: STRONG, level: 'A1' } });
  assert.equal(reg.status, 201);
  const tryLogin = (password) => client()('POST', '/api/auth/login', { json: { identifier: email, password } });

  for (let i = 0; i < 8; i += 1) assert.equal((await tryLogin('Errada#2026x')).status, 401);
  const locked = await tryLogin(STRONG);
  assert.equal(locked.status, 429, 'bloqueado mesmo com a senha certa');

  const t = await login(TEACHER.user, TEACHER.pass);
  const { tempPassword } = (await t('POST', `/api/teacher/students/${reg.data.user.id}/reset-password`)).data;
  const c = client();
  const first = await c('POST', '/api/auth/login', { json: { identifier: email, password: tempPassword } });
  assert.equal(first.status, 200, 'redefinir libera o bloqueio');
  assert.equal(first.data.user.mustChangePassword, true);

  const NEW = 'Rio#Claro2026k';
  const ch = await c('POST', '/api/auth/change-password', { json: { password: NEW } });
  assert.equal(ch.status, 200);
  assert.equal(ch.data.user.mustChangePassword, false);
  assert.equal((await c('GET', '/api/tracks')).status, 200, 'continua logada depois da troca');

  assert.equal((await tryLogin(tempPassword)).status, 401, 'provisória não vale mais');
  const again = await tryLogin(NEW);
  assert.equal(again.status, 200, 'entra com a senha nova');
  assert.equal(again.data.user.mustChangePassword, false);
});

test('professor(a) define a senha escolhida para o aluno', async () => {
  const email = 'lara.definir@exemplo.com';
  const reg = await client()('POST', '/api/auth/register', { json: { name: 'Lara Mendes', email, password: STRONG, level: 'A1' } });
  assert.equal(reg.status, 201);
  const sid = reg.data.user.id;
  const t = await login(TEACHER.user, TEACHER.pass);
  const setPw = (json) => t('POST', `/api/teacher/students/${sid}/set-password`, { json });

  assert.equal((await setPw({ password: 'fraca' })).data.code, 'WEAK_PASSWORD');
  assert.equal((await setPw({ password: 'Lara#2026x' })).status, 400, 'não aceita o nome do aluno');
  assert.equal((await setPw({ password: ' Morro#2026q' })).status, 400, 'sem espaço nas pontas');

  // Sem pedir troca: entra direto com a senha definida.
  const ok = await setPw({ password: 'Morro#2026q' });
  assert.equal(ok.status, 200);
  const l1 = await client()('POST', '/api/auth/login', { json: { identifier: email, password: 'Morro#2026q' } });
  assert.equal(l1.status, 200);
  assert.equal(l1.data.user.mustChangePassword, false);
  assert.equal((await client()('POST', '/api/auth/login', { json: { identifier: email, password: STRONG } })).status, 401, 'senha antiga não vale');

  // Pedindo troca: entra e é levado a criar uma senha própria.
  assert.equal((await setPw({ password: 'Praia#2026k', requireChange: true })).status, 200);
  const l2 = await client()('POST', '/api/auth/login', { json: { identifier: email, password: 'Praia#2026k' } });
  assert.equal(l2.data.user.mustChangePassword, true);

  // Só alunos; aluno não usa a rota.
  const staff = await db.one('SELECT id FROM users WHERE username = $1', [ADMIN.user]);
  assert.equal((await t('POST', `/api/teacher/students/${staff.id}/set-password`, { json: { password: 'Morro#2026q' } })).status, 404);
  const st = await login(email, 'Praia#2026k');
  assert.equal((await st('POST', `/api/teacher/students/${sid}/set-password`, { json: { password: 'Morro#2026q' } })).status, 403);
});
