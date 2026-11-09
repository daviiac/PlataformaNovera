'use strict';

const express = require('express');
const db = require('../db');
const { ah, requireAdmin } = require('../auth');
const { isLevel } = require('../tracks');
const { storage, ALLOWED, MAX_BYTES, extOf, isValidObjectPath, newObjectPath } = require('../storage');
const { materialDto, moduleDto } = require('../dto');
const config = require('../config');

const router = express.Router();

// IMPORTANTE: a checagem de perfil roda antes de qualquer handler deste router.
// Sem sessão de admin não se obtém URL de upload, não se grava arquivo e não se registra material.
router.use(requireAdmin);

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

router.get('/config', (req, res) => {
  res.json({ allowedExtensions: Object.keys(ALLOWED), maxUploadMb: config.MAX_UPLOAD_MB, storage: storage.name });
});

// ---------- Módulos ----------

router.get('/modules', ah(async (req, res) => {
  const track = req.query.track ? String(req.query.track).toUpperCase() : null;
  if (track && !isLevel(track)) return res.status(400).json({ error: 'Trilha inválida.' });

  const rows = await db.query(`
    SELECT m.*, COUNT(mt.id)::int AS material_count
    FROM modules m LEFT JOIN materials mt ON mt.module_id = m.id
    ${track ? 'WHERE m.track = $1' : ''}
    GROUP BY m.id ORDER BY m.track, m.position, m.id
  `, track ? [track] : []);

  res.json({ modules: rows.map((r) => ({ ...moduleDto(r), materialCount: r.material_count })) });
}));

router.post('/modules', ah(async (req, res) => {
  const track = str(req.body?.track, 4).toUpperCase();
  const title = str(req.body?.title, 120);
  const description = str(req.body?.description, 500);

  if (!isLevel(track)) return res.status(400).json({ error: 'Escolha uma trilha válida (A1, A2 ou B2).' });
  if (title.length < 2) return res.status(400).json({ error: 'Informe o título do módulo.' });

  try {
    const created = await db.one(`
      INSERT INTO modules (track, title, description, position)
      VALUES ($1, $2, $3, (SELECT COALESCE(MAX(position), 0) + 1 FROM modules WHERE track = $1))
      RETURNING *
    `, [track, title, description]);
    res.status(201).json({ module: { ...moduleDto(created), materialCount: 0 } });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Já existe um módulo com esse título nesta trilha.' });
    throw err;
  }
}));

router.delete('/modules/:id', ah(async (req, res) => {
  const id = Number(req.params.id);
  const mod = Number.isInteger(id) ? await db.one('SELECT * FROM modules WHERE id = $1', [id]) : null;
  if (!mod) return res.status(404).json({ error: 'Módulo não encontrado.' });

  const files = await db.query('SELECT stored_name FROM materials WHERE module_id = $1', [id]);
  await db.query('DELETE FROM modules WHERE id = $1', [id]); // materiais caem em cascata
  await Promise.all(files.map((f) => storage.remove(f.stored_name)));
  res.json({ ok: true, removedMaterials: files.length });
}));

// ---------- Upload de materiais (2 etapas) ----------
//
// 1) POST /uploads      -> valida tipo/tamanho/módulo e devolve uma URL de upload
//                          (assinada no Supabase; rota local no desenvolvimento)
// 2) PUT  <url>         -> o navegador envia o arquivo direto para o armazenamento
// 3) POST /materials    -> confere que o arquivo chegou e registra o material

async function findModule(moduleId) {
  const id = Number(moduleId);
  return Number.isInteger(id) ? db.one('SELECT * FROM modules WHERE id = $1', [id]) : null;
}

router.post('/uploads', ah(async (req, res) => {
  const fileName = str(req.body?.fileName, 200);
  const size = Number(req.body?.size);
  const info = ALLOWED[extOf(fileName)];

  if (!info) return res.status(400).json({ error: `Tipo de arquivo não permitido. Aceitos: ${Object.keys(ALLOWED).join(', ')}` });
  if (!Number.isFinite(size) || size <= 0) return res.status(400).json({ error: 'Arquivo vazio.' });
  if (size > MAX_BYTES) return res.status(400).json({ error: `Arquivo maior que o limite de ${config.MAX_UPLOAD_MB} MB.` });
  if (!(await findModule(req.body?.moduleId))) return res.status(400).json({ error: 'Escolha um módulo válido.' });

  const objectPath = newObjectPath(extOf(fileName));
  const upload = await storage.createUpload(objectPath, info.mime);
  res.status(201).json({ objectPath, upload });
}));

// Destino do PUT no modo local (desenvolvimento). Em produção o PUT vai direto ao Supabase.
router.put('/uploads/local/:name', ah(async (req, res) => {
  if (storage.name !== 'local') return res.status(404).json({ error: 'Rota indisponível.' });
  const objectPath = `materials/${req.params.name}`;
  if (!isValidObjectPath(objectPath)) return res.status(400).json({ error: 'Caminho de arquivo inválido.' });
  if (await storage.stat(objectPath)) return res.status(409).json({ error: 'Arquivo já enviado.' });
  const { size } = await storage.receive(req, objectPath);
  res.status(201).json({ ok: true, size });
}));

router.post('/materials', ah(async (req, res) => {
  const objectPath = req.body?.objectPath;
  const originalName = str(req.body?.originalName, 200);
  if (!isValidObjectPath(objectPath)) return res.status(400).json({ error: 'Envio inválido.' });

  const info = ALLOWED[extOf(objectPath)];
  if (extOf(originalName) !== extOf(objectPath)) return res.status(400).json({ error: 'Nome de arquivo inconsistente.' });

  const mod = await findModule(req.body?.moduleId);
  if (!mod) return res.status(400).json({ error: 'Escolha um módulo válido.' });

  const track = str(req.body?.track, 4).toUpperCase();
  if (track && track !== mod.track) return res.status(400).json({ error: 'O módulo escolhido não pertence a essa trilha.' });

  const stat = await storage.stat(objectPath);
  if (!stat) return res.status(400).json({ error: 'O arquivo não chegou ao armazenamento. Tente enviar novamente.' });
  if (stat.size > MAX_BYTES) {
    await storage.remove(objectPath);
    return res.status(400).json({ error: `Arquivo maior que o limite de ${config.MAX_UPLOAD_MB} MB.` });
  }

  const title = str(req.body?.title, 160) || originalName.replace(/\.[^.]+$/, '');
  const description = str(req.body?.description, 1000);

  let created;
  try {
    created = await db.one(`
      INSERT INTO materials (module_id, title, description, original_name, stored_name, mime_type, kind, size_bytes, uploaded_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *
    `, [mod.id, title, description, originalName, objectPath, info.mime, info.kind, stat.size, req.user.id]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Este arquivo já foi registrado.' });
    throw err;
  }
  res.status(201).json({ material: materialDto(created), module: moduleDto(mod) });
}));

router.delete('/materials/:id', ah(async (req, res) => {
  const id = Number(req.params.id);
  const mat = Number.isInteger(id) ? await db.one('SELECT * FROM materials WHERE id = $1', [id]) : null;
  if (!mat) return res.status(404).json({ error: 'Material não encontrado.' });

  await db.query('DELETE FROM materials WHERE id = $1', [id]);
  await storage.remove(mat.stored_name);
  res.json({ ok: true });
}));

// ---------- Atividades com vídeo do YouTube (quiz, música, videoaula) ----------

router.get('/activities', ah(async (req, res) => {
  const rows = await db.query(`
    SELECT a.id, a.type, a.level, a.title, a.description, a.data->>'youtubeId' AS youtube_id, a.created_at,
           (SELECT COUNT(*)::int FROM activity_attempts t WHERE t.activity_key = 'a-' || a.id) AS attempts
    FROM activities a ORDER BY a.created_at DESC, a.id DESC
  `);
  res.json({ activities: rows });
}));

router.post('/activities', ah(async (req, res) => {
  const { validateAdminActivity } = require('../activities/catalog');
  const a = validateAdminActivity(req.body);
  const row = await db.one(
    'INSERT INTO activities (type, level, title, description, data, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
    [a.type, a.level, a.title, a.description, JSON.stringify(a.data), req.user.id],
  );
  res.status(201).json({ ok: true, key: `a-${row.id}` });
}));

router.delete('/activities/:id', ah(async (req, res) => {
  const id = Number(req.params.id);
  const row = Number.isInteger(id) ? await db.one('DELETE FROM activities WHERE id = $1 RETURNING id', [id]) : null;
  if (!row) return res.status(404).json({ error: 'Atividade não encontrada.' });
  await db.query('DELETE FROM activity_attempts WHERE activity_key = $1', [`a-${id}`]);
  res.json({ ok: true });
}));

// ---------- Alunos ----------

router.get('/students', ah(async (req, res) => {
  const rows = await db.query(`
    SELECT u.id, u.name, u.email, u.level, u.created_at,
           (SELECT COUNT(*)::int FROM placement_results p WHERE p.user_id = u.id) AS attempts
    FROM users u WHERE u.role = 'student' ORDER BY u.created_at DESC, u.id DESC
  `);
  res.json({ students: rows });
}));

module.exports = router;
