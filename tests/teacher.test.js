'use strict';

// Aprovação de cadastros desligada aqui (os testes entram logo após cadastrar); testada à parte.
process.env.SIGNUP_APPROVAL = 'off';
// Login do cadastro (obrigatório): a parte do e-mail antes do @.
const U = (e) => String(e).split('@')[0].toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 30).padEnd(3, '0');

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
const ADMIN = { user: 'admin-teste', pass: 'Rio#Azul2026x' };
const TEACHER = { user: 'prof-teste', pass: 'Mar#Verde2026k' };
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
  assert.equal((await s('POST', '/api/auth/register', { json: { acceptTerms: true, guardianConsent: true,  name: 'Clara Nunes', email, username: U(email), password: STRONG, level: 'A1' } })).status, 201);
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
  assert.equal((await client()('POST', '/api/auth/login', { json: { identifier: U(email), password: STRONG } })).status, 401);

  // Entra com a provisória: só pode trocar a senha.
  const c = await login(U(email), temp);
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
  assert.equal((await client()('POST', '/api/auth/login', { json: { identifier: U(email), password: 'Nova#Senha77' } })).status, 200);
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
  const base = { name: 'Bruna Lima', username: 'bruna', email: 'bruna@exemplo.com', password: STRONG, level: 'A2', acceptTerms: true, guardianConsent: true };
  const noTerms = await client()('POST', '/api/auth/register', { json: { ...base, acceptTerms: false } });
  assert.equal(noTerms.status, 400, 'precisa aceitar os termos');
  assert.equal(noTerms.data.code, 'TERMS_REQUIRED');
  const noConsent = await client()('POST', '/api/auth/register', { json: { ...base, guardianConsent: false } });
  assert.equal(noConsent.status, 400, 'precisa confirmar idade ou autorização do responsável');
  assert.equal(noConsent.data.code, 'GUARDIAN_CONSENT_REQUIRED');
  assert.equal((await client()('POST', '/api/auth/register', { json: { acceptTerms: true, guardianConsent: true,  ...base, level: '' } })).status, 400);
  assert.equal((await client()('POST', '/api/auth/register', { json: { acceptTerms: true, guardianConsent: true,  ...base, level: 'C1' } })).status, 400);
  const weak = await client()('POST', '/api/auth/register', { json: { acceptTerms: true, guardianConsent: true,  ...base, password: 'bruna2026' } });
  assert.equal(weak.status, 400);
  assert.equal(weak.data.code, 'WEAK_PASSWORD');
  assert.match(weak.data.error, /maiúscula/);
  assert.equal((await client()('POST', '/api/auth/register', { json: { acceptTerms: true, guardianConsent: true,  ...base, name: '' } })).status, 400);
  // Login obrigatório, no formato certo e sem repetir o de outra pessoa.
  for (const username of [undefined, '', 'br', 'Bruna Lima', 'bruna@exemplo.com', 'joão']) {
    assert.equal((await client()('POST', '/api/auth/register', { json: { ...base, username } })).data.code, 'BAD_USERNAME', `login ${username}`);
  }
  assert.equal((await client()('POST', '/api/auth/register', { json: { ...base, username: TEACHER.user } })).data.code, 'USERNAME_TAKEN');
  await db.query('DELETE FROM auth_attempts'); // muitas tentativas de cadastro de propósito acima

  // Nível informado no cadastro já libera trilhas e atividades.
  const c = client();
  const ok = await c('POST', '/api/auth/register', { json: base });
  assert.equal(ok.status, 201);
  assert.equal(ok.data.user.level, 'A2');
  assert.equal((await c('GET', '/api/tracks/A2')).status, 200);
  const saved = await db.one('SELECT terms_accepted_at, guardian_consent_at, username FROM users WHERE email = $1', [base.email]);
  assert.ok(saved.terms_accepted_at && saved.guardian_consent_at, 'grava a data do aceite e da autorização');
  assert.equal(saved.username, 'bruna');
  assert.equal((await client()('POST', '/api/auth/login', { json: { identifier: 'BRUNA', password: STRONG } })).status, 200, 'entra com o login');
  const byEmail = await client()('POST', '/api/auth/login', { json: { identifier: base.email, password: STRONG } });
  assert.equal(byEmail.status, 401, 'não entra com o e-mail');

  // "Não sei" → sem nível, vai para o nivelamento.
  const d = client();
  const t = await d('POST', '/api/auth/register', { json: { acceptTerms: true, guardianConsent: true,  ...base, email: 'nao-sei@exemplo.com', username: 'nao-sei', level: 'TEST' } });
  assert.equal(t.data.user.level, null);
  assert.equal((await d('GET', '/api/tracks/A1')).data.code, 'PLACEMENT_REQUIRED');
  // Este teste faz várias tentativas de propósito; zera o limite de cadastros para os próximos.
  await db.query('DELETE FROM auth_attempts');
});

test('Controle Professor(a): só o login do professor acessa', async () => {
  assert.equal((await client()('GET', '/api/teacher/overview')).status, 401);

  const s = client();
  await s('POST', '/api/auth/register', { json: { acceptTerms: true, guardianConsent: true,  name: 'Caio Rocha', email: 'caio@exemplo.com', username: 'caio', password: STRONG, level: 'A1' } });
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
  await s('POST', '/api/auth/register', { json: { acceptTerms: true, guardianConsent: true,  name: 'Duda Alves', email: 'duda@exemplo.com', username: 'duda', password: STRONG, level: 'TEST' } });
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

  // Detalhe por atividade: quais atividades da categoria e quantas vezes cada uma.
  assert.equal(duda.categories.listen.items.length, 2, '2 atividades diferentes de Listening');
  await s('POST', '/api/activities/b-listen-at-the-bakery/attempts', { json: { score: 5, total: 6 } });
  const ov2 = (await t('GET', '/api/teacher/overview')).data.students.find((x) => x.id === duda.id);
  const bakery = ov2.categories.listen.items.find((i) => i.title === 'At the Bakery');
  assert.deepEqual({ a: bakery.attempts, best: bakery.best, total: bakery.total }, { a: 2, best: 5, total: 6 });
  assert.deepEqual(bakery.runs.map((r) => [r.n, r.score, r.total]), [[1, 4, 6], [2, 5, 6]], 'cada vez em ordem: 1ª e 2ª');
  assert.equal(bakery.key, 'b-listen-at-the-bakery');
  assert.equal(ov2.categories.listen.items.find((i) => i.title !== 'At the Bakery').attempts, 1);
  assert.equal(ov2.categories.listen.attempts, 3);
  const det2 = (await t('GET', `/api/teacher/students/${duda.id}`)).data;
  assert.equal(det2.attempts.filter((r) => r.key === 'b-listen-at-the-bakery').length, 2, 'cada vez aparece separada');
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
  const reg = await s('POST', '/api/auth/register', { json: { acceptTerms: true, guardianConsent: true,  name: 'Gabi Nunes', email: 'gabi@exemplo.com', username: 'gabi', password: STRONG, level: 'A1' } });
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
  const blocked = await client()('POST', '/api/auth/login', { json: { identifier: 'gabi', password: STRONG } });
  assert.equal(blocked.status, 403);
  assert.equal(blocked.data.code, 'ACCOUNT_INACTIVE');
  // Senha errada continua dando a mensagem genérica (não revela a situação da conta).
  const wrong = await client()('POST', '/api/auth/login', { json: { identifier: 'gabi', password: 'Errada#2026x' } });
  assert.equal(wrong.status, 401);
  const listed = (await t('GET', '/api/teacher/overview')).data.students.find((x) => x.id === sid);
  assert.equal(listed.active, false);
  assert.equal(listed.hits, 3, 'histórico mantido');

  // Reativar: entra de novo com a mesma senha.
  const on = await t('PATCH', `/api/teacher/students/${sid}/active`, { json: { active: true } });
  assert.equal(on.data.active, true);
  assert.equal(on.data.deactivatedAt, null);
  const back = await login('gabi', STRONG);
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
  const again = await client()('POST', '/api/auth/register', { json: { acceptTerms: true, guardianConsent: true,  name: 'Gabi Nunes', email: 'gabi@exemplo.com', username: 'gabi', password: STRONG, level: 'A1' } });
  assert.equal(again.status, 201);
});

test('senha provisória: aceita espaço ou quebra de linha copiados junto; senha normal continua exata', async () => {
  const s = client();
  const reg = await s('POST', '/api/auth/register', { json: { acceptTerms: true, guardianConsent: true,  name: 'Caio Prado', email: 'caio.temp@exemplo.com', username: 'caio.temp', password: STRONG, level: 'A1' } });
  assert.equal(reg.status, 201);
  const anon = () => client();
  // Senha normal: espaço a mais continua sendo senha errada.
  assert.equal((await anon()('POST', '/api/auth/login', { json: { identifier: 'caio.temp', password: `${STRONG} ` } })).status, 401);

  const t = await login(TEACHER.user, TEACHER.pass);
  const r1 = await t('POST', `/api/teacher/students/${reg.data.user.id}/reset-password`);
  const r2 = await t('POST', `/api/teacher/students/${reg.data.user.id}/reset-password`);
  const temp = r2.data.tempPassword;
  // Só a senha mais nova vale.
  assert.equal((await anon()('POST', '/api/auth/login', { json: { identifier: 'caio.temp', password: r1.data.tempPassword } })).status, 401);
  for (const pw of [`${temp} `, `${temp}\n`, ` ${temp}`, `\t${temp}\r\n`]) {
    const r = await anon()('POST', '/api/auth/login', { json: { identifier: 'caio.temp', password: pw } });
    assert.equal(r.status, 200, JSON.stringify(pw));
    assert.equal(r.data.user.mustChangePassword, true);
  }
  // Maiúsculas/minúsculas continuam importando.
  assert.equal((await anon()('POST', '/api/auth/login', { json: { identifier: 'caio.temp', password: temp.toLowerCase() } })).status, 401);
});

test('redefinir senha libera o bloqueio por tentativas; depois da troca entra só com a senha nova', async () => {
  const email = 'rita.bloqueio@exemplo.com';
  const s = client();
  const reg = await s('POST', '/api/auth/register', { json: { acceptTerms: true, guardianConsent: true,  name: 'Rita Lopes', email, username: U(email), password: STRONG, level: 'A1' } });
  assert.equal(reg.status, 201);
  const tryLogin = (password) => client()('POST', '/api/auth/login', { json: { identifier: U(email), password } });

  for (let i = 0; i < 8; i += 1) assert.equal((await tryLogin('Errada#2026x')).status, 401);
  const locked = await tryLogin(STRONG);
  assert.equal(locked.status, 429, 'bloqueado mesmo com a senha certa');

  const t = await login(TEACHER.user, TEACHER.pass);
  const { tempPassword } = (await t('POST', `/api/teacher/students/${reg.data.user.id}/reset-password`)).data;
  const c = client();
  const first = await c('POST', '/api/auth/login', { json: { identifier: U(email), password: tempPassword } });
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
  const reg = await client()('POST', '/api/auth/register', { json: { acceptTerms: true, guardianConsent: true,  name: 'Lara Mendes', email, username: U(email), password: STRONG, level: 'A1' } });
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
  const l1 = await client()('POST', '/api/auth/login', { json: { identifier: U(email), password: 'Morro#2026q' } });
  assert.equal(l1.status, 200);
  assert.equal(l1.data.user.mustChangePassword, false);
  assert.equal((await client()('POST', '/api/auth/login', { json: { identifier: U(email), password: STRONG } })).status, 401, 'senha antiga não vale');

  // Pedindo troca: entra e é levado a criar uma senha própria.
  assert.equal((await setPw({ password: 'Praia#2026k', requireChange: true })).status, 200);
  const l2 = await client()('POST', '/api/auth/login', { json: { identifier: U(email), password: 'Praia#2026k' } });
  assert.equal(l2.data.user.mustChangePassword, true);

  // Só alunos; aluno não usa a rota.
  const staff = await db.one('SELECT id FROM users WHERE username = $1', [ADMIN.user]);
  assert.equal((await t('POST', `/api/teacher/students/${staff.id}/set-password`, { json: { password: 'Morro#2026q' } })).status, 404);
  const st = await login(U(email), 'Praia#2026k');
  assert.equal((await st('POST', `/api/teacher/students/${sid}/set-password`, { json: { password: 'Morro#2026q' } })).status, 403);
});

test('professor(a) cria login para o aluno: entra com login e senha nova (o e-mail deixa de valer)', async () => {
  await db.query('DELETE FROM auth_attempts'); // todos os testes entram pelo mesmo IP
  const email = 'nina.login@exemplo.com';
  const reg = await client()('POST', '/api/auth/register', { json: { acceptTerms: true, guardianConsent: true,  name: 'Nina Rocha', email, username: U(email), password: STRONG, level: 'A1' } });
  const sid = reg.data.user.id;
  const t = await login(TEACHER.user, TEACHER.pass);
  const setPw = (json) => t('POST', `/api/teacher/students/${sid}/set-password`, { json });
  const tryLogin = (identifier, password) => client()('POST', '/api/auth/login', { json: { identifier, password } });

  assert.equal((await setPw({ password: 'Morro#2026q', username: 'ni na' })).data.code, 'BAD_USERNAME');
  assert.equal((await setPw({ password: 'Morro#2026q', username: 'joão' })).data.code, 'BAD_USERNAME');
  assert.equal((await setPw({ password: 'Morro#2026q', username: ADMIN.user })).data.code, 'USERNAME_TAKEN');
  assert.equal((await setPw({ password: 'Morro#2026q', username: 'duda@exemplo.com' })).data.code, 'BAD_USERNAME');

  const ok = await setPw({ password: 'Morro#2026q', username: 'NinaR' });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.student.username, 'ninar', 'login salvo em minúsculas');
  assert.equal((await tryLogin('ninar', 'Morro#2026q')).status, 200, 'entra com o login');
  assert.equal((await tryLogin('NINAR', 'Morro#2026q')).status, 200, 'maiúsculas no login não importam');
  assert.equal((await tryLogin(email, 'Morro#2026q')).status, 401, 'com login, o e-mail não serve para entrar');
  assert.equal((await tryLogin('ninar', STRONG)).status, 401, 'senha antiga não vale');
  const ov = (await t('GET', '/api/teacher/overview')).data.students.find((x) => x.id === sid);
  assert.equal(ov.username, 'ninar');

  // Outro aluno não pode usar o mesmo login.
  const other = await client()('POST', '/api/auth/register', { json: { acceptTerms: true, guardianConsent: true,  name: 'Otto Lima', email: 'otto.login@exemplo.com', username: 'otto.login', password: STRONG, level: 'A1' } });
  const dup = await t('POST', `/api/teacher/students/${other.data.user.id}/set-password`, { json: { password: 'Morro#2026q', username: 'ninar' } });
  assert.equal(dup.data.code, 'USERNAME_TAKEN');
  // Ninguém se cadastra com e-mail igual a um login existente (não há como, login não tem @) e o login some se ficar vazio.
  assert.equal((await setPw({ password: 'Praia#2026k', username: '' })).data.student.username, null);
  assert.equal((await tryLogin('ninar', 'Praia#2026k')).status, 401);
  assert.equal((await tryLogin(email, 'Praia#2026k')).status, 200, 'sem login, volta a entrar com o e-mail');
});

test('atividade não terminada: professora vê o % e o aluno vê como pendente; some ao concluir', async () => {
  await db.query('DELETE FROM auth_attempts');
  const st = client();
  const reg = await st('POST', '/api/auth/register', { json: { acceptTerms: true, guardianConsent: true,  name: 'Pia Torres', email: 'pia.pendente@exemplo.com', username: 'pia.pendente', password: STRONG, level: 'A1' } });
  const sid = reg.data.user.id;
  const key = 'b-order-introductions';
  const put = (json) => st('PUT', `/api/activities/${key}/progress`, { json });

  assert.equal((await put({ answered: 5, correct: 1, total: 4 })).status, 400, 'respondeu mais que o total');
  assert.equal((await put({ answered: 2, correct: 3, total: 4 })).status, 400, 'acertou mais que respondeu');
  assert.equal((await st('PUT', '/api/activities/b-nao-existe/progress', { json: { answered: 1, correct: 1, total: 4 } })).status, 404);
  assert.equal((await put({ answered: 1, correct: 1, total: 4 })).status, 200);
  assert.equal((await put({ answered: 2, correct: 1, total: 4, state: { i: 2, score: 1 } })).status, 200, 'atualiza o mesmo registro');
  assert.equal((await put({ answered: 2, correct: 1, total: 4, state: { big: 'x'.repeat(21000) } })).status, 400, 'estado grande demais');
  // Ao abrir de novo, a atividade vem com o progresso para continuar de onde parou.
  const open = (await st('GET', `/api/activities/${key}`)).data.activity;
  assert.deepEqual(open.progress, { answered: 2, correct: 1, total: 4, state: { i: 2, score: 1 } });

  const mine = (await st('GET', '/api/activities/pending')).data.pending;
  assert.equal(mine.length, 1);
  assert.equal(mine[0].key, key);
  assert.equal(mine[0].percent, 50);

  const t = await login(TEACHER.user, TEACHER.pass);
  const ov = (await t('GET', '/api/teacher/overview')).data.students.find((x) => x.id === sid);
  assert.equal(ov.pending.length, 1);
  assert.deepEqual([ov.pending[0].percent, ov.pending[0].answered, ov.pending[0].total, ov.pending[0].hits, ov.pending[0].misses], [50, 2, 4, 1, 1]);
  assert.ok(ov.lastAt, 'conta como última atividade');
  const det = (await t('GET', `/api/teacher/students/${sid}`)).data;
  assert.equal(det.pending[0].percent, 50);

  // Concluiu: sai das pendentes.
  assert.equal((await st('POST', `/api/activities/${key}/attempts`, { json: { score: 3, total: 4 } })).status, 201);
  assert.equal((await st('GET', '/api/activities/pending')).data.pending.length, 0);
  assert.equal((await st('GET', `/api/activities/${key}`)).data.activity.progress, null, 'concluída: começa do zero');
  assert.equal((await t('GET', '/api/teacher/overview')).data.students.find((x) => x.id === sid).pending.length, 0);
  // Sem login não há progresso.
  assert.equal((await client()('PUT', `/api/activities/${key}/progress`, { json: { answered: 1, correct: 1, total: 4 } })).status, 401);
});

test('segurança: professor(a) com senha fraca é obrigado(a) a criar uma forte; sessão curta para equipe', async () => {
  await db.query('DELETE FROM auth_attempts');
  // Senha fraca de propósito (só no banco temporário dos testes).
  await ensureTeacher({ username: 'prof-fraca', password: 'fraquinha1', name: 'Prof Fraca' });
  const c = client();
  const r = await c('POST', '/api/auth/login', { json: { identifier: 'prof-fraca', password: 'fraquinha1' } });
  assert.equal(r.status, 200);
  assert.equal(r.data.user.mustChangePassword, true, 'precisa trocar a senha');
  assert.match(r.headers.get('set-cookie'), /Max-Age=43200/, 'sessão de 12 horas para a equipe');
  assert.equal((await c('GET', '/api/teacher/overview')).data.code, 'PASSWORD_CHANGE_REQUIRED', 'nada funciona antes da troca');
  assert.equal((await c('POST', '/api/auth/change-password', { json: { password: 'Prof#Fraca2026q' } })).data.code, 'WEAK_PASSWORD', 'não aceita o próprio nome');
  assert.equal((await c('POST', '/api/auth/change-password', { json: { password: 'Lua#Cheia2026q' } })).status, 200);
  assert.equal((await c('GET', '/api/teacher/overview')).status, 200);
  // Com a senha forte, o próximo login entra direto.
  const again = await client()('POST', '/api/auth/login', { json: { identifier: 'prof-fraca', password: 'Lua#Cheia2026q' } });
  assert.equal(again.data.user.mustChangePassword, false);
});

test('segurança: pedidos de outro site são recusados', async () => {
  const t = await login(TEACHER.user, TEACHER.pass);
  const cookie = (await (async () => {
    const res = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ identifier: TEACHER.user, password: TEACHER.pass }) });
    return res.headers.get('set-cookie').split(';')[0];
  })());
  const cross = await fetch(`${base}/api/auth/logout`, { method: 'POST', headers: { cookie, 'sec-fetch-site': 'cross-site' } });
  assert.equal(cross.status, 403);
  const evil = await fetch(`${base}/api/auth/logout`, { method: 'POST', headers: { cookie, origin: 'https://site-malicioso.example' } });
  assert.equal(evil.status, 403);
  assert.equal((await t('GET', '/api/auth/me')).data.user.username, TEACHER.user);
});

test('cadastro novo aguarda aprovação: só entra depois que a professora aprova', async () => {
  process.env.SIGNUP_APPROVAL = 'on';
  await db.query('DELETE FROM auth_attempts');
  try {
    const email = 'aprovar@exemplo.com';
    const s = client();
    const reg = await s('POST', '/api/auth/register', { json: { acceptTerms: true, guardianConsent: true, name: 'Vera Aprovar', email, username: U(email), password: STRONG, level: 'A1' } });
    assert.equal(reg.status, 201);
    assert.equal(reg.data.pending, true, 'avisa que aguarda aprovação');
    assert.equal(reg.data.user, undefined, 'não devolve usuário logado');
    assert.equal((await s('GET', '/api/auth/me')).data?.user ?? null, null, 'não abre sessão');

    // Senha certa, mas ainda não aprovado.
    const blocked = await client()('POST', '/api/auth/login', { json: { identifier: U(email), password: STRONG } });
    assert.equal(blocked.status, 403);
    assert.equal(blocked.data.code, 'PENDING_APPROVAL');
    // Senha errada continua dizendo só "incorretos" (não revela a situação da conta).
    assert.equal((await client()('POST', '/api/auth/login', { json: { identifier: U(email), password: 'Errada#2026xx' } })).status, 401);
    // Aluno ansioso tenta várias vezes enquanto espera e acaba bloqueado por excesso de tentativas...
    let last;
    for (let i = 0; i < 7; i += 1) last = await client()('POST', '/api/auth/login', { json: { identifier: U(email), password: STRONG } });
    assert.equal(last.status, 429, 'bloqueado por excesso de tentativas');

    const t = await login(TEACHER.user, TEACHER.pass);
    const pend = (await t('GET', '/api/teacher/overview')).data.students.find((x) => x.email === email);
    assert.equal(pend.approval_pending, true, 'aparece para a professora como aguardando');

    // Aluno não aprova a si mesmo.
    assert.equal((await client()('POST', `/api/teacher/students/${pend.id}/approve`)).status, 401);
    assert.equal((await t('POST', '/api/teacher/students/999999/approve')).status, 404);
    assert.equal((await t('POST', `/api/teacher/students/${pend.id}/approve`)).status, 200);
    const ok = await client()('POST', '/api/auth/login', { json: { identifier: U(email), password: STRONG } });
    assert.equal(ok.status, 200, 'depois de aprovado, entra na mesma hora (a aprovação libera o bloqueio)');
    const row = await db.one('SELECT approval_pending, approved_at FROM users WHERE email = $1', [email]);
    assert.ok(!row.approval_pending && row.approved_at);

    // Recusar = apagar o cadastro.
    const reg2 = await client()('POST', '/api/auth/register', { json: { acceptTerms: true, guardianConsent: true, name: 'Rui Recusar', email: 'recusar@exemplo.com', username: 'recusar', password: STRONG, level: 'A2' } });
    assert.equal(reg2.data.pending, true);
    const rid = (await t('GET', '/api/teacher/overview')).data.students.find((x) => x.email === 'recusar@exemplo.com').id;
    assert.equal((await t('DELETE', `/api/teacher/students/${rid}`)).status, 200);
    assert.equal((await client()('POST', '/api/auth/login', { json: { identifier: 'recusar', password: STRONG } })).status, 401);
  } finally {
    process.env.SIGNUP_APPROVAL = 'off';
  }
});

test('aviso por e-mail: sem configuração não envia e não quebra o cadastro; professora vê a situação', async () => {
  const { notifyNewSignup, emailConfigured, emailStatus, maskEmail } = require('../src/notify');
  const KEYS = ['BREVO_API_KEY', 'NOTIFY_FROM', 'NOTIFY_EMAIL', 'GMAIL_USER', 'GMAIL_APP_PASSWORD'];
  const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  KEYS.forEach((k) => delete process.env[k]);
  try {
    assert.equal(emailConfigured(), false);
    assert.deepEqual(await notifyNewSignup({ name: 'X', email: 'x@exemplo.com', level: 'A1' }), { sent: false, reason: 'não configurado' });

    const t = await login(TEACHER.user, TEACHER.pass);
    assert.deepEqual((await t('GET', '/api/teacher/email-status')).data, { configured: false, provider: null, to: null });
    assert.equal((await t('POST', '/api/teacher/email-test')).data.code, 'EMAIL_NOT_CONFIGURED');
    assert.equal((await client()('GET', '/api/teacher/email-status')).status, 401, 'só a equipe vê');

    // Com o Gmail configurado: um único envio, do Gmail da escola para ele mesmo (mascarado na tela).
    process.env.GMAIL_USER = 'escola.teste@gmail.com';
    process.env.GMAIL_APP_PASSWORD = 'abcd efgh ijkl mnop';
    assert.deepEqual(emailStatus(), { configured: true, provider: 'gmail', to: 'es**********@gmail.com' });
    process.env.NOTIFY_EMAIL = 'outra@exemplo.com';
    assert.equal(emailStatus().to, 'es**********@gmail.com', 'não existe outro destinatário');
    process.env.BREVO_API_KEY = 'x';
    process.env.NOTIFY_FROM = 'y@exemplo.com';
    delete process.env.GMAIL_APP_PASSWORD;
    assert.equal(emailConfigured(), false, 'não existe outro tipo de envio');
    assert.equal(maskEmail('ab@x.com'), 'ab*@x.com');

    // Motivo da recusa do Gmail explicado em português.
    const { gmailReason } = require('../src/notify');
    assert.match(gmailReason({ code: 'EAUTH', response: '534-5.7.9 Application-specific password required.' }), /SENHA DE APP/);
    assert.match(gmailReason({ code: 'EAUTH', response: '535-5.7.8 Username and Password not accepted.' }), /não aceitou o e-mail ou a senha de app/);
    assert.match(gmailReason({ code: 'EAUTH', response: '534-5.7.14 Please log in via your web browser' }), /bloqueou o acesso/);
    assert.match(gmailReason({ code: 'ETIMEDOUT', message: 'Connection timeout' }), /tempo esgotado/);
  } finally {
    KEYS.forEach((k) => { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; });
  }
});
