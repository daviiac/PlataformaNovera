'use strict';

// Testes de integração da API: rodam o servidor real com banco e pasta de upload temporários.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'novera-test-'));
process.env.DB_PATH = path.join(tmp, 'test.db');
process.env.UPLOAD_DIR = path.join(tmp, 'uploads');

const app = require('../src/server');
const db = require('../src/db');
const { ensureAdmin, ensureDefaultModules } = require('../scripts/seed');
const { QUESTIONS } = require('../src/placement');

// Senha usada só no banco temporário dos testes (nunca a senha real do admin).
const TEST_ADMIN_PASSWORD = 'senha-de-teste-123';

let server;
let base;

/** Cliente HTTP mínimo que guarda o cookie de sessão. */
function client() {
  let cookie = '';
  return async (method, url, { json, form } = {}) => {
    const headers = {};
    if (cookie) headers.cookie = cookie;
    let body;
    if (json) { headers['content-type'] = 'application/json'; body = JSON.stringify(json); }
    if (form) body = form;
    const res = await fetch(base + url, { method, headers, body, redirect: 'manual' });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch { data = text; }
    return { status: res.status, data, headers: res.headers };
  };
}

function uploadForm(moduleId, name = 'aula.pdf', content = '%PDF-1.4 teste') {
  const form = new FormData();
  form.append('moduleId', String(moduleId));
  form.append('title', 'Material de teste');
  form.append('file', new Blob([content], { type: 'application/pdf' }), name);
  return form;
}

before(async () => {
  await ensureAdmin({ username: 'davi', password: TEST_ADMIN_PASSWORD, name: 'Davi' });
  ensureDefaultModules();
  await new Promise((resolve) => { server = app.listen(0, resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
  db.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('senha do admin é armazenada apenas como hash bcrypt', () => {
  const row = db.prepare("SELECT password_hash FROM users WHERE username = 'davi'").get();
  assert.match(row.password_hash, /^\$2[aby]\$12\$/);
  assert.ok(!row.password_hash.includes(TEST_ADMIN_PASSWORD));
});

test('cadastro, login com senha errada e senha com hash', async () => {
  const c = client();
  const reg = await c('POST', '/api/auth/register', { json: { name: 'Ana', email: 'ana@exemplo.com', password: 'segredo123' } });
  assert.equal(reg.status, 201);
  assert.equal(reg.data.user.role, 'student');
  assert.equal(reg.data.user.level, null);

  const dup = await client()('POST', '/api/auth/register', { json: { name: 'Ana', email: 'ANA@exemplo.com', password: 'segredo123' } });
  assert.equal(dup.status, 409);

  const bad = await client()('POST', '/api/auth/login', { json: { identifier: 'ana@exemplo.com', password: 'errada' } });
  assert.equal(bad.status, 401);

  const row = db.prepare("SELECT password_hash FROM users WHERE email = 'ana@exemplo.com'").get();
  assert.match(row.password_hash, /^\$2[aby]\$/);
});

test('aluno sem nivelamento não acessa trilhas; após o teste recebe o nível', async () => {
  const c = client();
  await c('POST', '/api/auth/register', { json: { name: 'Bia', email: 'bia@exemplo.com', password: 'segredo123' } });

  const blocked = await c('GET', '/api/tracks/A1');
  assert.equal(blocked.status, 403);
  assert.equal(blocked.data.code, 'PLACEMENT_REQUIRED');

  const qs = await c('GET', '/api/placement/questions');
  assert.equal(qs.data.questions.length, QUESTIONS.length);
  assert.ok(qs.data.questions.every((q) => !('answer' in q)), 'respostas não podem vazar para o cliente');

  // Acerta A1 e A2, erra B2 -> 5 + 10 = 15 pontos -> A2
  const answers = {};
  for (const q of QUESTIONS) answers[q.id] = q.band === 'B2' ? (q.answer + 1) % q.options.length : q.answer;
  const sub = await c('POST', '/api/placement/submit', { json: { answers } });
  assert.equal(sub.status, 200);
  assert.equal(sub.data.result.level, 'A2');

  const me = await c('GET', '/api/auth/me');
  assert.equal(me.data.user.level, 'A2');

  const track = await c('GET', '/api/tracks/A2');
  assert.equal(track.status, 200);
  assert.equal(track.data.isOwnLevel, true);

  const other = await c('GET', '/api/tracks/B2');
  assert.equal(other.status, 200, 'aluno pode navegar para outras trilhas');
  assert.equal(other.data.isOwnLevel, false);
});

test('nivelamento: todas certas = B2, todas erradas = A1, incompleto = 400', async () => {
  const c = client();
  await c('POST', '/api/auth/register', { json: { name: 'Caio', email: 'caio@exemplo.com', password: 'segredo123' } });
  const right = Object.fromEntries(QUESTIONS.map((q) => [q.id, q.answer]));
  const wrong = Object.fromEntries(QUESTIONS.map((q) => [q.id, (q.answer + 1) % q.options.length]));
  assert.equal((await c('POST', '/api/placement/submit', { json: { answers: right } })).data.result.level, 'B2');
  assert.equal((await c('POST', '/api/placement/submit', { json: { answers: wrong } })).data.result.level, 'A1');
  assert.equal((await c('POST', '/api/placement/submit', { json: { answers: { 'a1-1': 1 } } })).status, 400);
});

test('upload: anônimo recebe 401, aluno recebe 403 e nada é gravado no disco', async () => {
  const mod = db.prepare("SELECT id FROM modules WHERE track = 'A1' LIMIT 1").get();
  const before = fs.readdirSync(process.env.UPLOAD_DIR).length;

  const anon = await client()('POST', '/api/admin/materials', { form: uploadForm(mod.id) });
  assert.equal(anon.status, 401);

  const student = client();
  await student('POST', '/api/auth/register', { json: { name: 'Davi Aluno', email: 'aluno@exemplo.com', password: 'segredo123' } });
  const forb = await student('POST', '/api/admin/materials', { form: uploadForm(mod.id) });
  assert.equal(forb.status, 403);

  for (const [method, url, opts] of [
    ['GET', '/api/admin/modules', {}],
    ['POST', '/api/admin/modules', { json: { track: 'A1', title: 'Hack' } }],
    ['DELETE', `/api/admin/modules/${mod.id}`, {}],
    ['GET', '/api/admin/students', {}],
  ]) {
    assert.equal((await student(method, url, opts)).status, 403, `${method} ${url}`);
  }

  // A página do painel também não é entregue a alunos.
  const page = await student('GET', '/admin');
  assert.equal(page.status, 302);
  const script = await student('GET', '/admin/admin.js');
  assert.equal(script.status, 302);

  assert.equal(fs.readdirSync(process.env.UPLOAD_DIR).length, before);
});

test('admin faz login com usuário, envia material e aluno baixa', async () => {
  const admin = client();
  const login = await admin('POST', '/api/auth/login', { json: { identifier: 'davi', password: TEST_ADMIN_PASSWORD } });
  assert.equal(login.status, 200);
  assert.equal(login.data.user.role, 'admin');

  const page = await admin('GET', '/admin');
  assert.equal(page.status, 200);

  const created = await admin('POST', '/api/admin/modules', { json: { track: 'B2', title: 'Listening avançado' } });
  assert.equal(created.status, 201);

  const bad = await admin('POST', '/api/admin/materials', { form: uploadForm(created.data.module.id, 'virus.exe') });
  assert.equal(bad.status, 400);

  const up = await admin('POST', '/api/admin/materials', { form: uploadForm(created.data.module.id, 'Aula de revisão.pdf') });
  assert.equal(up.status, 201);
  assert.equal(up.data.material.kind, 'pdf');
  assert.equal(up.data.material.originalName, 'Aula de revisão.pdf');

  // Aluno com nível consegue baixar.
  const student = client();
  await student('POST', '/api/auth/register', { json: { name: 'Edu', email: 'edu@exemplo.com', password: 'segredo123' } });
  const answers = Object.fromEntries(QUESTIONS.map((q) => [q.id, q.answer]));
  await student('POST', '/api/placement/submit', { json: { answers } });

  const track = await student('GET', '/api/tracks/B2');
  const mod = track.data.modules.find((m) => m.title === 'Listening avançado');
  assert.equal(mod.materials.length, 1);

  const dl = await student('GET', mod.materials[0].downloadUrl);
  assert.equal(dl.status, 200);
  assert.equal(dl.data, '%PDF-1.4 teste');
  assert.match(dl.headers.get('content-disposition'), /^attachment/);

  const anon = await client()('GET', mod.materials[0].downloadUrl);
  assert.equal(anon.status, 401);

  // Remoção apaga o arquivo do disco.
  const del = await admin('DELETE', `/api/admin/materials/${up.data.material.id}`);
  assert.equal(del.status, 200);
  assert.equal((await student('GET', mod.materials[0].downloadUrl)).status, 404);
});

test('pré-visualização de documentos: docx, pptx, xlsx e txt', async () => {
  const { makeDocx, makePptx, makeXlsx } = require('./fixtures');
  const admin = client();
  await admin('POST', '/api/auth/login', { json: { identifier: 'davi', password: TEST_ADMIN_PASSWORD } });
  const mod = db.prepare("SELECT id FROM modules WHERE track = 'A1' LIMIT 1").get();

  const send = async (name, buf) => {
    const form = new FormData();
    form.append('moduleId', String(mod.id));
    form.append('file', new Blob([buf]), name);
    const r = await admin('POST', '/api/admin/materials', { form });
    assert.equal(r.status, 201, name);
    return r.data.material;
  };

  const docx = await send('aula.docx', await makeDocx());
  const pptx = await send('slides.pptx', await makePptx());
  const xlsx = await send('vocab.xlsx', await makeXlsx());
  const txt = await send('notas.txt', Buffer.from('Hello <b>world</b>'));
  const doc = await send('antigo.doc', Buffer.from('binario'));

  assert.equal(docx.preview, 'html');
  assert.equal(doc.preview, 'none');

  const student = client();
  await student('POST', '/api/auth/register', { json: { name: 'Fabi', email: 'fabi@exemplo.com', password: 'segredo123' } });
  await student('POST', '/api/placement/submit', { json: { answers: Object.fromEntries(QUESTIONS.map((q) => [q.id, 0])) } });

  const d = await student('GET', docx.viewUrl);
  assert.equal(d.status, 200);
  assert.match(d.headers.get('content-type'), /text\/html/);
  assert.match(d.headers.get('content-security-policy'), /default-src 'none'/);
  assert.match(d.data, /Verb to be &amp; pronouns/);
  assert.ok(!d.data.includes('<script>'), 'conteúdo do documento deve ser escapado');

  const p = await student('GET', pptx.viewUrl);
  assert.match(p.data, /Slide 2/);
  assert.match(p.data, /Irregular verbs/);
  assert.match(p.data, /go - went - gone/);

  const x = await student('GET', xlsx.viewUrl);
  assert.match(x.data, /Vocabulário/);
  assert.match(x.data, /maçã/);
  assert.match(x.data, /<td>42<\/td>/);

  const t = await student('GET', txt.viewUrl);
  assert.match(t.data, /Hello &lt;b&gt;world&lt;\/b&gt;/);

  assert.equal((await student('GET', `/api/materials/${doc.id}/preview`)).status, 415);
  assert.equal((await client()('GET', docx.viewUrl)).status, 401);
});
