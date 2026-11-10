'use strict';

const express = require('express');
const db = require('../db');
const { ah, requireAuth, requirePlacement } = require('../auth');
const { TRACKS, isLevel } = require('../tracks');
const { materialDto, moduleDto } = require('../dto');
const { LESSONS, HOMEWORK, HOMEWORK_BY_KEY } = require('../lessons/catalog');
const { embedUrl } = require('../lessons/canva');
const { unlockedLevels, requireUnlocked, levelHistory } = require('../levels');
const { storage } = require('../storage');

const router = express.Router();
router.use(requireAuth);

/** Visão geral: trilhas, níveis liberados e histórico de nível do aluno. */
router.get('/', ah(async (req, res) => {
  const [counts, unlocked, history, files] = await Promise.all([
    db.query(`
      SELECT m.track, COUNT(DISTINCT m.id)::int AS modules, COUNT(mt.id)::int AS materials
      FROM modules m LEFT JOIN materials mt ON mt.module_id = m.id
      GROUP BY m.track
    `),
    unlockedLevels(req.user),
    req.user.role === 'student' ? levelHistory(req.user.id) : [],
    db.query('SELECT key FROM homework_files'),
  ]);
  const byTrack = Object.fromEntries(counts.map((c) => [c.track, c]));
  const uploaded = new Set(files.map((f) => f.key));

  res.json({
    userLevel: req.user.level,
    unlocked,
    history: history.map((h) => ({
      from: h.from_level, to: h.to_level, at: h.created_at,
      by: h.changed_by_role === 'teacher' || h.changed_by_role === 'admin' ? h.changed_by_name : null,
    })),
    tracks: TRACKS.map((t) => ({
      ...t,
      locked: !unlocked.includes(t.level),
      lessons: LESSONS[t.level].length,
      homework: HOMEWORK.filter((h) => h.level === t.level && uploaded.has(h.key)).length,
      modules: byTrack[t.level]?.modules || 0,
      materials: byTrack[t.level]?.materials || 0,
    })),
  });
}));

/** Mapa de aulas do nível: apresentações (link do Canva) e homeworks de cada aula. */
router.get('/:level/lessons', requirePlacement, requireUnlocked(), ah(async (req, res) => {
  const level = String(req.params.level).toUpperCase();
  if (!isLevel(level)) return res.status(404).json({ error: 'Trilha não encontrada.' });
  const [links, files] = await Promise.all([
    db.query('SELECT lesson, url FROM lesson_links WHERE level = $1', [level]),
    db.query('SELECT key, size_bytes FROM homework_files'),
  ]);
  const urlBy = new Map(links.map((l) => [l.lesson, l.url]));
  const fileBy = new Map(files.map((f) => [f.key, f]));
  res.json({
    track: TRACKS.find((t) => t.level === level),
    lessons: LESSONS[level].map((l) => ({
      number: l.n,
      title: l.title,
      pages: l.pages,
      extra: Boolean(l.extra),
      url: urlBy.get(l.n) || null,
      embed: embedUrl(urlBy.get(l.n)),
      homework: HOMEWORK.filter((h) => h.level === level && h.lesson === l.n).map((h) => ({
        key: h.key,
        code: h.code,
        title: h.title,
        description: h.description,
        pages: h.pages,
        available: fileBy.has(h.key),
        size: fileBy.has(h.key) ? Number(fileBy.get(h.key).size_bytes) : null,
      })),
    })),
  });
}));

/** PDF de um homework (só para quem tem o nível liberado). */
router.get('/homework/:key/file', requirePlacement, ah(async (req, res, next) => {
  const hw = HOMEWORK_BY_KEY.get(String(req.params.key));
  if (!hw) return res.status(404).json({ error: 'Homework não encontrado.' });
  const unlocked = await unlockedLevels(req.user);
  if (!unlocked.includes(hw.level)) return res.status(403).json({ error: 'Este nível será liberado pela sua professora.', code: 'LEVEL_LOCKED' });
  const file = await db.one('SELECT stored_name FROM homework_files WHERE key = $1', [hw.key]);
  if (!file) return res.status(404).json({ error: 'Este homework ainda não foi publicado.' });
  await storage.send(res, {
    stored_name: file.stored_name,
    original_name: `${hw.code.replace(/ · /g, ' - ')} - ${hw.title}.pdf`.replace(/[\\/:*?"<>|]/g, ''),
    mime_type: 'application/pdf',
  }, { inline: req.query.inline === '1' });
}));

/** Módulos e materiais extras de uma trilha. */
router.get('/:level', requirePlacement, requireUnlocked(), ah(async (req, res) => {
  const level = String(req.params.level).toUpperCase();
  if (!isLevel(level)) return res.status(404).json({ error: 'Trilha não encontrada.' });

  const [modules, materials] = await Promise.all([
    db.query('SELECT * FROM modules WHERE track = $1 ORDER BY position, id', [level]),
    db.query(`
      SELECT mt.* FROM materials mt JOIN modules m ON m.id = mt.module_id
      WHERE m.track = $1 ORDER BY mt.created_at, mt.id
    `, [level]),
  ]);

  const grouped = new Map(modules.map((m) => [m.id, { ...moduleDto(m), materials: [] }]));
  for (const mt of materials) grouped.get(mt.module_id)?.materials.push(materialDto(mt));

  res.json({
    track: TRACKS.find((t) => t.level === level),
    isOwnLevel: req.user.level === level,
    userLevel: req.user.level,
    modules: [...grouped.values()],
  });
}));

module.exports = router;
