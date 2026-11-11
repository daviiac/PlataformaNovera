'use strict';

// Testes: trilha de aulas, homeworks e controle de nível pela professora.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'novera-lessons-'));
process.env.PGLITE_DIR = 'memory';
process.env.UPLOAD_DIR = path.join(tmp, 'uploads');
for (const k of ['DATABASE_URL', 'POSTGRES_URL', 'SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY', 'VERCEL']) delete process.env[k];

const app = require('../src/app');
const db = require('../src/db');
const { ensureAdmin, ensureTeacher, ensureDefaultModules } = require('../scripts/seed');
const { HOMEWORK, LESSONS } = require('../src/lessons/catalog');
const { QUESTIONS } = require('../src/placement');

const ADMIN = { user: 'admin-teste', pass: 'Rio#Azul2026x' };
const TEACHER = { user: 'prof-teste', pass: 'Mar#Verde2026k' };
const STRONG = 'Lago#Verde2026';
let server;
let base;

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
async function login(u, p) {
  const c = client();
  assert.equal((await c('POST', '/api/auth/login', { json: { identifier: u, password: p } })).status, 200);
  return c;
}
async function student(email, level) {
  const c = client();
  assert.equal((await c('POST', '/api/auth/register', { json: { acceptTerms: true,  name: 'Aluno Teste', email, password: STRONG, level } })).status, 201);
  return c;
}

before(async () => {
  await ensureAdmin({ username: ADMIN.user, password: ADMIN.pass, name: 'Admin' });
  await ensureTeacher({ username: TEACHER.user, password: TEACHER.pass, name: 'Prof' });
  await ensureDefaultModules();
  await new Promise((r) => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  server.close();
  await db.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('catálogo: 62 homeworks numerados por nível e ligados a aulas existentes', () => {
  assert.equal(HOMEWORK.length, 62);
  for (const lvl of ['A1', 'A2', 'B2']) {
    const list = HOMEWORK.filter((h) => h.level === lvl);
    assert.deepEqual(list.map((h) => h.seq), list.map((_, i) => i + 1), `${lvl}: numeração em sequência`);
    for (const h of list) assert.ok(LESSONS[lvl].some((l) => l.n === h.lesson), `${h.code}: aula ${h.lesson} existe`);
    // A numeração acompanha a ordem das aulas
    assert.deepEqual(list.map((h) => h.lesson), list.map((h) => h.lesson).slice().sort((a, b) => a - b));
  }
  assert.equal(HOMEWORK[0].code, 'A1 · HW 01');
});

test('mapa de aulas do nível e bloqueio dos próximos níveis', async () => {
  const s = await student('mapa@exemplo.com', 'A1');
  const ov = await s('GET', '/api/tracks');
  assert.deepEqual(ov.data.unlocked, ['A1']);
  assert.deepEqual(ov.data.tracks.map((t) => t.locked), [false, true, true]);

  const a1 = await s('GET', '/api/tracks/A1/lessons');
  assert.equal(a1.status, 200);
  assert.equal(a1.data.lessons.length, 11);
  assert.equal(a1.data.lessons[1].title, 'Daily Routine');
  assert.equal(a1.data.lessons[1].homework.length, 5);
  assert.equal(a1.data.lessons[1].homework[0].available, false, 'ainda não publicado');

  assert.equal((await s('GET', '/api/tracks/A2/lessons')).data.code, 'LEVEL_LOCKED');
  assert.equal((await s('GET', '/api/activities/b-listen-lost-suitcase')).status, 403, 'atividade A2 bloqueada');
  const list = await s('GET', '/api/activities?type=listen');
  assert.ok(list.data.activities.some((a) => a.level === 'A2' && a.locked));
  assert.ok(list.data.activities.some((a) => a.level === 'A1' && !a.locked));
});

test('admin publica link da aula e importa homework pelo nome do arquivo', async () => {
  const a = await login(ADMIN.user, ADMIN.pass);
  assert.equal((await a('PUT', '/api/admin/lessons/A1/2/link', { json: { url: 'javascript:alert(1)' } })).status, 400);
  assert.equal((await a('PUT', '/api/admin/lessons/A1/99/link', { json: { url: 'https://x.com' } })).status, 404);
  // Link de EDIÇÃO do Canva é recusado (deixaria o aluno editar); o de visualização é padronizado.
  const edit = await a('PUT', '/api/admin/lessons/A1/2/link', { json: { url: 'https://www.canva.com/design/DAExemplo1/ChaveEdicao123/edit' } });
  assert.equal(edit.status, 400);
  assert.match(edit.data.error, /EDIÇÃO/);
  const link = await a('PUT', '/api/admin/lessons/A1/2/link', { json: { url: 'https://www.canva.com/design/DAExemplo1/ChaveVisual123/view?utm_content=x' } });
  assert.equal(link.status, 200);
  assert.equal(link.data.url, 'https://www.canva.com/design/DAExemplo1/ChaveVisual123/view');

  const unknown = await a('POST', '/api/admin/homework/uploads', { json: { fileName: 'qualquer.pdf', size: 10 } });
  assert.equal(unknown.data.code, 'UNKNOWN_FILE');

  const hw = HOMEWORK.find((h) => h.level === 'A1' && h.lesson === 2);
  const start = await a('POST', '/api/admin/homework/uploads', { json: { fileName: hw.file, size: 12 } });
  assert.equal(start.status, 201);
  assert.equal(start.data.key, hw.key);
  const put = await a('PUT', start.data.upload.url, { body: Buffer.from('%PDF-1.4 hw1'), headers: start.data.upload.headers });
  assert.equal(put.status, 201);
  assert.equal((await a('POST', '/api/admin/homework', { json: { key: hw.key, objectPath: start.data.objectPath } })).status, 201);

  // Aluno do nível vê o link e baixa o PDF; aluno de nível sem acesso não baixa.
  const s = await student('hw@exemplo.com', 'A1');
  const map = await s('GET', '/api/tracks/A1/lessons');
  assert.equal(map.data.lessons[1].url, 'https://www.canva.com/design/DAExemplo1/ChaveVisual123/view');
  assert.equal(map.data.lessons[1].embed, 'https://www.canva.com/design/DAExemplo1/ChaveVisual123/view?embed');
  assert.equal(map.data.lessons[1].homework.find((h) => h.key === hw.key).available, true);
  const file = await s('GET', `/api/tracks/homework/${hw.key}/file`);
  assert.equal(file.status, 200);
  assert.equal(file.data, '%PDF-1.4 hw1');

  const b2hw = HOMEWORK.find((h) => h.level === 'B2');
  assert.equal((await s('GET', `/api/tracks/homework/${b2hw.key}/file`)).status, 403);

  // Aluno não importa homework
  assert.equal((await s('POST', '/api/admin/homework/uploads', { json: { fileName: hw.file, size: 12 } })).status, 403);
});

test('só a professora (ou admin) muda o nível; aluno vê nível anterior e novo', async () => {
  const s = await student('nivel@exemplo.com', 'A1');
  const me = (await s('GET', '/api/auth/me')).data.user;

  // Refazer o nivelamento não muda mais o nível.
  const right = Object.fromEntries(QUESTIONS.map((q) => [q.id, q.answer]));
  const sub = await s('POST', '/api/placement/submit', { json: { answers: right } });
  assert.equal(sub.data.result.level, 'B2');
  assert.equal(sub.data.levelApplied, false);
  assert.equal((await s('GET', '/api/auth/me')).data.user.level, 'A1');

  assert.equal((await s('PATCH', `/api/teacher/students/${me.id}/level`, { json: { level: 'B2' } })).status, 403, 'aluno não muda o próprio nível');

  const t = await login(TEACHER.user, TEACHER.pass);
  assert.equal((await t('PATCH', `/api/teacher/students/${me.id}/level`, { json: { level: 'C1' } })).status, 400);
  assert.equal((await t('PATCH', `/api/teacher/students/${me.id}/level`, { json: { level: 'A1' } })).status, 400, 'mesmo nível');
  const ch = await t('PATCH', `/api/teacher/students/${me.id}/level`, { json: { level: 'A2' } });
  assert.equal(ch.status, 200);
  assert.deepEqual(ch.data.unlocked, ['A1', 'A2']);

  const ov = await s('GET', '/api/tracks');
  assert.equal(ov.data.userLevel, 'A2');
  assert.deepEqual(ov.data.unlocked, ['A1', 'A2']);
  assert.equal(ov.data.history[0].from, 'A1');
  assert.equal(ov.data.history[0].to, 'A2');
  assert.equal((await s('GET', '/api/tracks/B2/lessons')).status, 403, 'B2 ainda bloqueado');

  // Professora volta o aluno para A1: A2 continua liberado (nível antigo).
  await t('PATCH', `/api/teacher/students/${me.id}/level`, { json: { level: 'A1' } });
  assert.deepEqual((await s('GET', '/api/tracks')).data.unlocked, ['A1', 'A2']);

  // Admin também pode.
  const a = await login(ADMIN.user, ADMIN.pass);
  assert.equal((await a('PATCH', `/api/teacher/students/${me.id}/level`, { json: { level: 'B2' } })).status, 200);
  assert.deepEqual((await s('GET', '/api/tracks')).data.unlocked, ['A1', 'A2', 'B2']);

  const det = await t('GET', `/api/teacher/students/${me.id}`);
  assert.equal(det.data.levelHistory.length, 3);
  const over = await t('GET', '/api/teacher/overview');
  assert.equal(over.data.students.find((x) => x.id === me.id).previous_level, 'A1');
});
