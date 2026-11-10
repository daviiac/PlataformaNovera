'use strict';

const express = require('express');
const db = require('../db');
const { ah, requireAuth, requirePlacement } = require('../auth');
const { storage, INLINE_KINDS } = require('../storage');
const { canPreview, buildPreviewPage } = require('../preview');
const { unlockedLevels } = require('../levels');

const router = express.Router();
router.use(requireAuth, requirePlacement);

async function findMaterial(idParam) {
  const id = Number(idParam);
  return Number.isInteger(id)
    ? db.one('SELECT mt.*, m.track FROM materials mt JOIN modules m ON m.id = mt.module_id WHERE mt.id = $1', [id])
    : null;
}

// Materiais de um nível ainda não liberado ficam bloqueados para o aluno.
router.use('/:id', ah(async (req, res, next) => {
  const m = await findMaterial(req.params.id);
  if (m && !(await unlockedLevels(req.user)).includes(m.track)) {
    return res.status(403).json({ error: 'Este nível será liberado pela sua professora.', code: 'LEVEL_LOCKED' });
  }
  next();
}));

/**
 * Download/visualização de um material. Só usuários autenticados chegam aqui;
 * em produção a resposta é um redirecionamento para uma URL assinada e temporária
 * do Supabase Storage (o arquivo não passa pela função da Vercel).
 */
router.get('/:id/download', ah(async (req, res) => {
  const material = await findMaterial(req.params.id);
  if (!material) return res.status(404).json({ error: 'Material não encontrado.' });
  const inline = req.query.inline === '1' && INLINE_KINDS.has(material.kind);
  await storage.send(res, material, { inline });
}));

/**
 * Pré-visualização de documentos (docx, pptx, xlsx, odt, txt) como página HTML
 * estática. A CSP desta resposta isola o documento (sandbox) e proíbe scripts.
 */
const previewCache = new Map(); // id -> html (cache por instância)
const PREVIEW_CACHE_MAX = 20;

router.get('/:id/preview', ah(async (req, res) => {
  const material = await findMaterial(req.params.id);
  if (!material) return res.status(404).json({ error: 'Material não encontrado.' });
  if (!canPreview(material.original_name)) {
    return res.status(415).json({ error: 'Pré-visualização indisponível para este formato. Baixe o arquivo.' });
  }

  let html = previewCache.get(material.id);
  if (!html) {
    try {
      const buffer = await storage.read(material.stored_name);
      html = await buildPreviewPage(buffer, material.original_name, material.title);
    } catch (err) {
      console.error('Falha ao gerar pré-visualização', material.id, err.message);
      return res.status(422).json({ error: 'Não foi possível ler este arquivo para pré-visualizar. Baixe o arquivo.' });
    }
    if (previewCache.size >= PREVIEW_CACHE_MAX) previewCache.delete(previewCache.keys().next().value);
    previewCache.set(material.id, html);
  }

  res.set({
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy': "default-src 'none'; img-src data:; style-src 'unsafe-inline'; frame-ancestors 'self'; sandbox allow-popups allow-popups-to-escape-sandbox",
    'Cache-Control': 'private, max-age=600',
  });
  res.send(html);
}));

module.exports = router;
