'use strict';

const express = require('express');
const db = require('../db');
const { requireAuth, requirePlacement } = require('../auth');
const { TRACKS, isLevel } = require('../tracks');
const { materialDto, moduleDto } = require('../dto');

const router = express.Router();
router.use(requireAuth);

/** Visão geral das três trilhas (para a navegação entre níveis). */
router.get('/', (req, res) => {
  const counts = db.prepare(`
    SELECT m.track, COUNT(DISTINCT m.id) AS modules, COUNT(mt.id) AS materials
    FROM modules m LEFT JOIN materials mt ON mt.module_id = m.id
    GROUP BY m.track
  `).all();
  const byTrack = Object.fromEntries(counts.map((c) => [c.track, c]));

  res.json({
    userLevel: req.user.level,
    tracks: TRACKS.map((t) => ({
      ...t,
      modules: byTrack[t.level]?.modules || 0,
      materials: byTrack[t.level]?.materials || 0,
    })),
  });
});

/** Módulos e materiais de uma trilha. */
router.get('/:level', requirePlacement, (req, res) => {
  const level = String(req.params.level).toUpperCase();
  if (!isLevel(level)) return res.status(404).json({ error: 'Trilha não encontrada.' });

  const modules = db.prepare('SELECT * FROM modules WHERE track = ? ORDER BY position, id').all(level);
  const materials = db.prepare(`
    SELECT mt.* FROM materials mt JOIN modules m ON m.id = mt.module_id
    WHERE m.track = ? ORDER BY mt.created_at, mt.id
  `).all(level);

  const grouped = new Map(modules.map((m) => [m.id, { ...moduleDto(m), materials: [] }]));
  for (const mt of materials) grouped.get(mt.module_id)?.materials.push(materialDto(mt));

  res.json({
    track: TRACKS.find((t) => t.level === level),
    isOwnLevel: req.user.level === level,
    userLevel: req.user.level,
    modules: [...grouped.values()],
  });
});

module.exports = router;
