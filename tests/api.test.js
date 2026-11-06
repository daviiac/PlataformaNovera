'use strict';

// Testes de integração da API: sobem o app real com Postgres em memória (PGlite)
// e armazenamento local temporário — sem depender do Supabase.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'novera-test-'));
process.env.PGLITE_DIR = 'memory';
process.env.UPLOAD_DIR = path.join(tmp, 'uploads');
delete process.env.DATABASE_URL;
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.VERCEL;
for (const k of ['POSTGRES_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SECRET_KEY']) delete process.env[k];

const app = require('../src/app');
const db = require('../src/db');
const { ensureAdmin, ensureDefaultModules } = require('../scripts/seed');
const { QUESTIONS } = require('../src/placement');
const { makeDocx, makePptx, makeXlsx } = require('./fixtures');

// Senha usada só no banco temporário dos testes (nunca a senha real do admin).
const TEST_ADMIN_PASSWORD = 'senha-de-teste-123';

let server;
let base;

/** Cliente HTTP mínimo que guarda o cookie de sessão. */
function client() {
  let cookie = '';
  return async (method, url, { json, body, headers: extra } = {}) => {
    const headers = { ...extra };
    if (cookie) headers.cookie = cookie;
    let payload = body;
    if (json) { headers['content-type'] = 'application/json'; payload = JSON.stringify(json); }
    const res = await fetch(base + url, { method, headers, body: payload, redirect: 'manual' });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch { data = text; }
    return { status: res.status, data, headers: res.headers };
  };
}

/** Fluxo completo de upload: pede URL -> envia o arquivo -> registra o material. */
async function uploadMaterial(admin, moduleId, name, content, title) {
  const buf = Buffer.isBuffer(content) ? content : Buffer.from(content);
  const start = await admin('POST', '/api/admin/uploads', { json: { fileName: name, size: buf.length, moduleId } });
  if (start.status !== 201) return start;
  const put = await admin(start.data.upload.method, start.data.upload.url, { body: buf, headers: start.data.upload.headers });
  assert.equal(put.status, 201, `PUT ${name}`);
  return admin('POST', '/api/admin/materials', {
    json: { objectPath: start.data.objectPath, originalName: name, moduleId, title },
  });
}

async function newStudent(name, email, { placed = true } = {}) {
  const c = client();
  const r = await c('POST', '/api/auth/register', { json: { name, email, password: 'segredo123' } });
  assert.equal(r.status, 201);
  if (placed) {
    await c('POST', '/api/placement/submit', { json: { answers: Object.fromEntries(QUESTIONS.map((q) => [q.id, q.answer])) } });
  }
  return c;
}

async function adminClient() {
  const admin = client();
  const login = await admin('POST', '/api/auth/login', { json: { identifier: 'davi', password: TEST_ADMIN_PASSWORD } });
  assert.equal(login.status, 200);
  return admin;
}

const firstModule = async (track = 'A1') => (await db.one('SELECT id FROM modules WHERE track = $1 ORDER BY id LIMIT 1', [track])).id;
const uploadedFiles = () => (fs.existsSync(process.env.UPLOAD_DIR) ? fs.readdirSync(process.env.UPLOAD_DIR) : []);

before(async () => {
  await ensureAdmin({ username: 'davi', password: TEST_ADMIN_PASSWORD, name: 'Davi' });
  await ensureDefaultModules();
  await new Promise((resolve) => { server = app.listen(0, resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server.close();
  await db.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('senha do admin é armazenada apenas como hash bcrypt', async () => {
  const row = await db.one("SELECT password_hash FROM users WHERE username = 'davi'");
  assert.match(row.password_hash, /^\$2[aby]\$12\$/);
  assert.ok(!row.password_hash.includes(TEST_ADMIN_PASSWORD));
});

test('cadastro, e-mail duplicado, login com senha errada e senha com hash', async () => {
  const c = client();
  const reg = await c('POST', '/api/auth/register', { json: { name: 'Ana', email: 'ana@exemplo.com', password: 'segredo123' } });
  assert.equal(reg.status, 201);
  assert.equal(reg.data.user.role, 'student');
  assert.equal(reg.data.user.level, null);

  const dup = await client()('POST', '/api/auth/register', { json: { name: 'Ana', email: 'ANA@exemplo.com', password: 'segredo123' } });
  assert.equal(dup.status, 409);

  const bad = await client()('POST', '/api/auth/login', { json: { identifier: 'ana@exemplo.com', password: 'errada' } });
  assert.equal(bad.status, 401);

  const row = await db.one("SELECT password_hash FROM users WHERE email = 'ana@exemplo.com'");
  assert.match(row.password_hash, /^\$2[aby]\$/);

  const me = await c('GET', '/api/auth/me');
  assert.equal(me.data.user.email, 'ana@exemplo.com');
  await c('POST', '/api/auth/logout');
  assert.equal((await c('GET', '/api/auth/me')).data.user, null);
});

test('aluno sem nivelamento não acessa trilhas; após o teste recebe o nível', async () => {
  const c = await newStudent('Bia', 'bia@exemplo.com', { placed: false });

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
  assert.equal((await c('GET', '/api/auth/me')).data.user.level, 'A2');

  const track = await c('GET', '/api/tracks/A2');
  assert.equal(track.status, 200);
  assert.equal(track.data.isOwnLevel, true);

  const other = await c('GET', '/api/tracks/B2');
  assert.equal(other.status, 200, 'aluno pode navegar para outras trilhas');
  assert.equal(other.data.isOwnLevel, false);

  const overview = await c('GET', '/api/tracks');
  assert.equal(overview.data.tracks.length, 3);
  assert.equal(typeof overview.data.tracks[0].modules, 'number');
});

test('nivelamento: todas certas = B2, todas erradas = A1, incompleto = 400', async () => {
  const c = await newStudent('Caio', 'caio@exemplo.com', { placed: false });
  const right = Object.fromEntries(QUESTIONS.map((q) => [q.id, q.answer]));
  const wrong = Object.fromEntries(QUESTIONS.map((q) => [q.id, (q.answer + 1) % q.options.length]));
  assert.equal((await c('POST', '/api/placement/submit', { json: { answers: right } })).data.result.level, 'B2');
  assert.equal((await c('POST', '/api/placement/submit', { json: { answers: wrong } })).data.result.level, 'A1');
  assert.equal((await c('POST', '/api/placement/submit', { json: { answers: { 'a1-1': 1 } } })).status, 400);
});

test('upload: anônimo recebe 401, aluno recebe 403 e nada é gravado', async () => {
  const moduleId = await firstModule();
  const before = uploadedFiles().length;
  const startBody = { json: { fileName: 'aula.pdf', size: 10, moduleId } };

  assert.equal((await client()('POST', '/api/admin/uploads', startBody)).status, 401);

  const student = await newStudent('Davi Aluno', 'aluno@exemplo.com');
  assert.equal((await student('POST', '/api/admin/uploads', startBody)).status, 403);

  // Tentar gravar diretamente na rota de PUT local também é bloqueado.
  const put = await student('PUT', '/api/admin/uploads/local/00000000-0000-4000-8000-000000000000.pdf', { body: Buffer.from('x') });
  assert.equal(put.status, 403);

  for (const [method, url, opts] of [
    ['GET', '/api/admin/modules', {}],
    ['POST', '/api/admin/modules', { json: { track: 'A1', title: 'Hack' } }],
    ['DELETE', `/api/admin/modules/${moduleId}`, {}],
    ['POST', '/api/admin/materials', { json: { objectPath: 'materials/00000000-0000-4000-8000-000000000000.pdf', originalName: 'a.pdf', moduleId } }],
    ['GET', '/api/admin/students', {}],
  ]) {
    assert.equal((await student(method, url, opts)).status, 403, `${method} ${url}`);
  }

  // A página do painel e o script dela também não são entregues a alunos.
  assert.equal((await student('GET', '/admin')).status, 302);
  assert.equal((await student('GET', '/admin/admin.js')).status, 302);

  assert.equal(uploadedFiles().length, before);
});

test('upload valida tipo, tamanho e se o arquivo realmente chegou', async () => {
  const admin = await adminClient();
  const moduleId = await firstModule();

  const exe = await admin('POST', '/api/admin/uploads', { json: { fileName: 'virus.exe', size: 10, moduleId } });
  assert.equal(exe.status, 400);

  const huge = await admin('POST', '/api/admin/uploads', { json: { fileName: 'filme.mp4', size: 51 * 1024 * 1024, moduleId } });
  assert.equal(huge.status, 400);

  const noModule = await admin('POST', '/api/admin/uploads', { json: { fileName: 'a.pdf', size: 10, moduleId: 999999 } });
  assert.equal(noModule.status, 400);

  // Registrar sem ter enviado o arquivo
  const start = await admin('POST', '/api/admin/uploads', { json: { fileName: 'a.pdf', size: 10, moduleId } });
  const ghost = await admin('POST', '/api/admin/materials', { json: { objectPath: start.data.objectPath, originalName: 'a.pdf', moduleId } });
  assert.equal(ghost.status, 400);

  // Caminho fora do padrão (path traversal)
  const evil = await admin('POST', '/api/admin/materials', { json: { objectPath: '../../.env', originalName: '.env', moduleId } });
  assert.equal(evil.status, 400);
});

test('admin faz login com usuário, envia material e aluno baixa', async () => {
  const admin = await adminClient();
  assert.equal((await admin('GET', '/admin')).status, 200);

  const created = await admin('POST', '/api/admin/modules', { json: { track: 'B2', title: 'Listening avançado' } });
  assert.equal(created.status, 201);
  const dupMod = await admin('POST', '/api/admin/modules', { json: { track: 'B2', title: 'Listening avançado' } });
  assert.equal(dupMod.status, 409);

  const up = await uploadMaterial(admin, created.data.module.id, 'Aula de revisão.pdf', '%PDF-1.4 teste', 'Revisão');
  assert.equal(up.status, 201);
  assert.equal(up.data.material.kind, 'pdf');
  assert.equal(up.data.material.originalName, 'Aula de revisão.pdf');
  assert.equal(up.data.material.size, 14);

  const student = await newStudent('Edu', 'edu@exemplo.com');
  const track = await student('GET', '/api/tracks/B2');
  const mod = track.data.modules.find((m) => m.title === 'Listening avançado');
  assert.equal(mod.materials.length, 1);

  const dl = await student('GET', mod.materials[0].downloadUrl);
  assert.equal(dl.status, 200);
  assert.equal(dl.data, '%PDF-1.4 teste');
  assert.match(dl.headers.get('content-disposition'), /^attachment/);

  const inline = await student('GET', mod.materials[0].viewUrl);
  assert.match(inline.headers.get('content-disposition'), /^inline/);

  assert.equal((await client()('GET', mod.materials[0].downloadUrl)).status, 401);

  // Remoção apaga o arquivo do armazenamento.
  const filesBefore = uploadedFiles().length;
  assert.equal((await admin('DELETE', `/api/admin/materials/${up.data.material.id}`)).status, 200);
  assert.equal(uploadedFiles().length, filesBefore - 1);
  assert.equal((await student('GET', mod.materials[0].downloadUrl)).status, 404);

  // Excluir módulo remove os arquivos dos materiais dele.
  await uploadMaterial(admin, created.data.module.id, 'extra.txt', 'texto');
  const delMod = await admin('DELETE', `/api/admin/modules/${created.data.module.id}`);
  assert.equal(delMod.data.removedMaterials, 1);
  assert.equal(uploadedFiles().length, filesBefore - 1);
});

test('pré-visualização de documentos: docx, pptx, xlsx e txt', async () => {
  const admin = await adminClient();
  const moduleId = await firstModule();

  const send = async (name, buf) => {
    const r = await uploadMaterial(admin, moduleId, name, buf);
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

  const student = await newStudent('Fabi', 'fabi@exemplo.com');

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
