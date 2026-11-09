'use strict';

// Testes das Atividades e Worksheets (API + correção de respostas do navegador).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'novera-act-'));
process.env.PGLITE_DIR = 'memory';
process.env.UPLOAD_DIR = path.join(tmp, 'uploads');
for (const k of ['DATABASE_URL', 'POSTGRES_URL', 'SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY', 'VERCEL']) delete process.env[k];

const app = require('../src/app');
const db = require('../src/db');
const { ensureAdmin, ensureDefaultModules } = require('../scripts/seed');
const { QUESTIONS } = require('../src/placement');
const { BUILTIN } = require('../src/activities/catalog');

const ADMIN = { user: 'admin-teste', pass: 'senha-de-teste-123' };
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

async function student(email, { placed = true } = {}) {
  const c = client();
  assert.equal((await c('POST', '/api/auth/register', { json: { name: 'Aluno', email, password: 'segredo123' } })).status, 201);
  if (placed) await c('POST', '/api/placement/submit', { json: { answers: Object.fromEntries(QUESTIONS.map((q) => [q.id, q.answer])) } });
  return c;
}

async function admin() {
  const c = client();
  assert.equal((await c('POST', '/api/auth/login', { json: { identifier: ADMIN.user, password: ADMIN.pass } })).status, 200);
  return c;
}

before(async () => {
  await ensureAdmin({ username: ADMIN.user, password: ADMIN.pass, name: 'Admin' });
  await ensureDefaultModules();
  await new Promise((r) => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server.close();
  await db.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('conteúdo próprio: estrutura válida em todas as atividades', () => {
  for (const a of BUILTIN) {
    const d = a.data;
    const tag = `${a.key}`;
    assert.ok(['A1', 'A2', 'B2'].includes(a.level), tag);
    if (a.type === 'listen') {
      for (const [who] of d.lines) assert.ok(d.speakers[who], `${tag}: falante sem voz (${who})`);
      for (const q of d.questions) assert.ok(q.answer >= 0 && q.answer < q.options.length, tag);
    }
    if (a.type === 'grammar_quiz') {
      for (const it of d.items) {
        if (it.kind === 'choice') assert.ok(it.answer >= 0 && it.answer < it.options.length, tag);
        else assert.ok(it.accepted.length > 0, tag);
      }
      assert.ok(BUILTIN.some((x) => x.key === d.lessonKey), `${tag}: lição ligada não existe`);
    }
    if (a.type === 'text_correction') assert.ok((d.text.match(/\[[^|\]]+\|[^\]]+\]/g) || []).length >= 3, tag);
    if (a.type === 'worksheet') {
      for (const p of d.pages) {
        if (p.kind === 'choose') for (const it of p.items) assert.ok(it.answer < it.options.length, tag);
        if (p.kind === 'fill') for (const s of p.sentences) {
          const m = /\[([^\]]+)\]/.exec(s);
          assert.ok(m && p.bank.includes(m[1]), `${tag}: lacuna "${s}" sem palavra no quadro`);
        }
      }
    }
  }
});

test('aluno sem nivelamento não acessa atividades; anônimo recebe 401', async () => {
  assert.equal((await client()('GET', '/api/activities/types')).status, 401);
  const c = await student('sem-nivel@exemplo.com', { placed: false });
  const r = await c('GET', '/api/activities/types');
  assert.equal(r.status, 403);
  assert.equal(r.data.code, 'PLACEMENT_REQUIRED');
});

test('aluno lista tipos, filtra por nível, abre atividade e salva resultado', async () => {
  const c = await student('ativo@exemplo.com');
  const types = await c('GET', '/api/activities/types');
  assert.equal(types.status, 200);
  const listen = types.data.types.find((t) => t.key === 'listen');
  assert.equal(listen.total, 7);

  const list = await c('GET', '/api/activities?type=listen&level=A1');
  assert.equal(list.status, 200);
  assert.ok(list.data.activities.length >= 3);
  assert.ok(list.data.activities.every((a) => a.level === 'A1'));

  const key = list.data.activities[0].key;
  const one = await c('GET', `/api/activities/${key}`);
  assert.equal(one.status, 200);
  assert.ok(one.data.activity.data.lines.length > 0);

  assert.equal((await c('POST', `/api/activities/${key}/attempts`, { json: { score: 4, total: 6 } })).status, 201);
  const second = await c('POST', `/api/activities/${key}/attempts`, { json: { score: 6, total: 6 } });
  assert.deepEqual(second.data.best, { score: 6, total: 6 });
  const again = await c('GET', '/api/activities?type=listen&level=A1');
  assert.deepEqual(again.data.activities.find((a) => a.key === key).best, { score: 6, total: 6 });

  // Resultado inválido
  assert.equal((await c('POST', `/api/activities/${key}/attempts`, { json: { score: 9, total: 6 } })).status, 400);
  assert.equal((await c('GET', '/api/activities/b-nao-existe')).status, 404);
  assert.equal((await c('GET', '/api/activities?type=hack')).status, 400);
});

test('só o admin cria atividades com vídeo; validação dos dados', async () => {
  const quiz = {
    type: 'quiz', level: 'A2', title: 'Ordering food', youtube: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    data: { questions: [{ time: 65, prompt: 'What does she order?', options: ['Soup', 'Pizza', 'Salad'], answer: 1 }] },
  };
  const s = await student('nao-admin@exemplo.com');
  assert.equal((await s('POST', '/api/admin/activities', { json: quiz })).status, 403);

  const a = await admin();
  assert.equal((await a('POST', '/api/admin/activities', { json: { ...quiz, youtube: 'https://evil.example/watch?v=dQw4w9WgXcQ' } })).status, 400);
  assert.equal((await a('POST', '/api/admin/activities', { json: { ...quiz, data: { questions: [{ time: 5, prompt: 'x', options: ['a'], answer: 0 }] } } })).status, 400);

  const created = await a('POST', '/api/admin/activities', { json: quiz });
  assert.equal(created.status, 201);
  const one = await s('GET', `/api/activities/${created.data.key}`);
  assert.equal(one.data.activity.data.youtubeId, 'dQw4w9WgXcQ');
  assert.equal(one.data.activity.data.questions[0].time, 65);

  const song = await a('POST', '/api/admin/activities', { json: {
    type: 'song', level: 'A1', title: 'Our song', youtube: 'dQw4w9WgXcQ',
    data: { lines: [{ time: 12, text: 'Every [morning] I wake up' }, { time: null, text: 'And I [walk] to the [river]' }] },
  } });
  assert.equal(song.status, 201);
  const noGap = await a('POST', '/api/admin/activities', { json: {
    type: 'song', level: 'A1', title: 'Sem lacuna', youtube: 'dQw4w9WgXcQ', data: { lines: [{ text: 'no gaps here' }] },
  } });
  assert.equal(noGap.status, 400);

  const listSong = await s('GET', '/api/activities?type=song');
  assert.equal(listSong.data.activities[0].count.n, 3);

  const id = created.data.key.slice(2);
  assert.equal((await s('DELETE', `/api/admin/activities/${id}`)).status, 403);
  assert.equal((await a('DELETE', `/api/admin/activities/${id}`)).status, 200);
  assert.equal((await s('GET', `/api/activities/${created.data.key}`)).status, 404);
});

test('páginas novas existem e o script do criador é só para admin', async () => {
  const s = await student('paginas@exemplo.com');
  assert.equal((await s('GET', '/atividades')).status, 200);
  assert.equal((await s('GET', '/atividade')).status, 200);
  assert.equal((await s('GET', '/admin/admin-activities.js')).status, 302);
  const a = await admin();
  assert.equal((await a('GET', '/admin/admin-activities.js')).status, 200);
  const csp = (await s('GET', '/atividades')).headers.get('content-security-policy');
  assert.match(csp, /frame-src[^;]*youtube-nocookie\.com/);
  assert.match(csp, /script-src[^;]*www\.youtube\.com/);
});

test('correção no navegador: contrações, pontuação e maiúsculas', () => {
  const code = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'act-common.js'), 'utf8');
  const ctx = { window: {}, Novera: { esc: (s) => s, api: async () => ({}) }, location: { origin: 'http://x' }, document: {}, setTimeout };
  vm.createContext(ctx);
  vm.runInContext(`${code}; this.Act = Act;`, ctx);
  const { same } = ctx.Act;
  assert.ok(same("I'm a student.", 'I am a student'));
  assert.ok(same('we aren’t brothers', 'We are not brothers.'));
  assert.ok(same("She doesn't work here", 'She does not work here'));
  assert.ok(same("I can't swim!", 'I cannot swim'));
  assert.ok(same("It's high time", 'It is high time'));
  assert.ok(same('  MY   NAME is carla ', 'My name is Carla.'));
  assert.ok(same('I go to bed at 11', 'I go to bed at eleven.'));
  assert.ok(same('My father is 50', 'My father is fifty'));
  assert.ok(same('twenty-five students', '25 students'));
  assert.ok(!same('I go to bed at 10', 'I go to bed at eleven'));
  assert.ok(!same('She work here', 'She works here'));
  assert.ok(!same('I am a teacher', 'I am a student'));
});
