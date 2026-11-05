'use strict';

const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../auth');
const { isLevel } = require('../tracks');
const { upload, ALLOWED, extOf, removeStoredFile } = require('../uploads');
const { materialDto, moduleDto } = require('../dto');
const config = require('../config');

const router = express.Router();

// IMPORTANTE: a checagem de perfil roda antes de qualquer handler deste router,
// inclusive antes do multer — um não-admin não consegue nem gravar bytes no disco.
router.use(requireAdmin);

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

router.get('/config', (req, res) => {
  res.json({ allowedExtensions: Object.keys(ALLOWED), maxUploadMb: config.MAX_UPLOAD_MB });
});

// ---------- Módulos ----------

router.get('/modules', (req, res) => {
  const track = req.query.track ? String(req.query.track).toUpperCase() : null;
  if (track && !isLevel(track)) return res.status(400).json({ error: 'Trilha inválida.' });

  const rows = db.prepare(`
    SELECT m.*, COUNT(mt.id) AS material_count
    FROM modules m LEFT JOIN materials mt ON mt.module_id = m.id
    ${track ? 'WHERE m.track = ?' : ''}
    GROUP BY m.id ORDER BY m.track, m.position, m.id
  `).all(...(track ? [track] : []));

  res.json({ modules: rows.map((r) => ({ ...moduleDto(r), materialCount: r.material_count })) });
});

router.post('/modules', (req, res) => {
  const track = str(req.body?.track, 4).toUpperCase();
  const title = str(req.body?.title, 120);
  const description = str(req.body?.description, 500);

  if (!isLevel(track)) return res.status(400).json({ error: 'Escolha uma trilha válida (A1, A2 ou B2).' });
  if (title.length < 2) return res.status(400).json({ error: 'Informe o título do módulo.' });

  const dup = db.prepare('SELECT 1 FROM modules WHERE track = ? AND title = ?').get(track, title);
  if (dup) return res.status(409).json({ error: 'Já existe um módulo com esse título nesta trilha.' });

  const { pos } = db.prepare('SELECT COALESCE(MAX(position), 0) + 1 AS pos FROM modules WHERE track = ?').get(track);
  const result = db.prepare('INSERT INTO modules (track, title, description, position) VALUES (?, ?, ?, ?)')
    .run(track, title, description, pos);

  const created = db.prepare('SELECT * FROM modules WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ module: { ...moduleDto(created), materialCount: 0 } });
});

router.delete('/modules/:id', (req, res) => {
  const id = Number(req.params.id);
  const mod = db.prepare('SELECT * FROM modules WHERE id = ?').get(id);
  if (!mod) return res.status(404).json({ error: 'Módulo não encontrado.' });

  const files = db.prepare('SELECT stored_name FROM materials WHERE module_id = ?').all(id);
  db.prepare('DELETE FROM modules WHERE id = ?').run(id); // materiais caem em cascata
  files.forEach((f) => removeStoredFile(f.stored_name));
  res.json({ ok: true, removedMaterials: files.length });
});

// ---------- Materiais ----------

router.post('/materials', upload.single('file'), (req, res) => {
  const file = req.file;
  const fail = (status, error) => {
    if (file) removeStoredFile(file.filename);
    return res.status(status).json({ error });
  };

  if (!file) return fail(400, 'Selecione um arquivo para enviar.');

  const moduleId = Number(req.body?.moduleId);
  const mod = Number.isInteger(moduleId) ? db.prepare('SELECT * FROM modules WHERE id = ?').get(moduleId) : null;
  if (!mod) return fail(400, 'Escolha um módulo válido.');

  const track = str(req.body?.track, 4).toUpperCase();
  if (track && track !== mod.track) return fail(400, 'O módulo escolhido não pertence a essa trilha.');

  const info = ALLOWED[extOf(file.originalname)];
  if (!info) return fail(400, 'Tipo de arquivo não permitido.');

  // Multer entrega o nome como latin1; convertemos para preservar acentos.
  const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8').slice(0, 200);
  const title = str(req.body?.title, 160) || originalName.replace(/\.[^.]+$/, '');
  const description = str(req.body?.description, 1000);

  const result = db.prepare(`
    INSERT INTO materials (module_id, title, description, original_name, stored_name, mime_type, kind, size_bytes, uploaded_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(mod.id, title, description, originalName, file.filename, info.mime, info.kind, file.size, req.user.id);

  const created = db.prepare('SELECT * FROM materials WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ material: materialDto(created), module: moduleDto(mod) });
});

router.delete('/materials/:id', (req, res) => {
  const id = Number(req.params.id);
  const mat = db.prepare('SELECT * FROM materials WHERE id = ?').get(id);
  if (!mat) return res.status(404).json({ error: 'Material não encontrado.' });

  db.prepare('DELETE FROM materials WHERE id = ?').run(id);
  removeStoredFile(mat.stored_name);
  res.json({ ok: true });
});

// ---------- Alunos ----------

router.get('/students', (req, res) => {
  const rows = db.prepare(`
    SELECT u.id, u.name, u.email, u.level, u.created_at,
           (SELECT COUNT(*) FROM placement_results p WHERE p.user_id = u.id) AS attempts
    FROM users u WHERE u.role = 'student' ORDER BY u.created_at DESC, u.id DESC
  `).all();
  res.json({ students: rows });
});

module.exports = router;
