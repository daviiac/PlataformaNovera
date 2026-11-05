'use strict';

const fs = require('node:fs');
const express = require('express');
const db = require('../db');
const { requireAuth, requirePlacement } = require('../auth');
const { storedPath, INLINE_KINDS } = require('../uploads');
const { canPreview, buildPreviewPage } = require('../preview');

const router = express.Router();
router.use(requireAuth, requirePlacement);

/**
 * Download/visualização de um material publicado. Os arquivos ficam fora da
 * pasta pública e só são entregues a usuários autenticados.
 */
router.get('/:id/download', (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(404).json({ error: 'Material não encontrado.' });

  const material = db.prepare('SELECT * FROM materials WHERE id = ?').get(id);
  if (!material) return res.status(404).json({ error: 'Material não encontrado.' });

  let filePath;
  try {
    filePath = storedPath(material.stored_name);
  } catch {
    return res.status(404).json({ error: 'Material não encontrado.' });
  }
  if (!fs.existsSync(filePath)) return res.status(410).json({ error: 'Arquivo indisponível no servidor.' });

  const inline = req.query.inline === '1' && INLINE_KINDS.has(material.kind);
  const encoded = encodeURIComponent(material.original_name);
  const asciiName = material.original_name.replace(/[^\x20-\x7e]|["\\]/g, '_');

  res.set({
    'Content-Type': material.mime_type,
    'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${asciiName}"; filename*=UTF-8''${encoded}`,
    'Cache-Control': 'private, max-age=3600',
  });
  // sendFile dá suporte a Range (necessário para avançar em áudio/vídeo).
  res.sendFile(filePath, { headers: { 'Content-Type': material.mime_type } }, (err) => {
    if (err && !res.headersSent) next(err);
  });
});

/**
 * Pré-visualização de documentos (docx, pptx, xlsx, odt, txt) como página HTML
 * estática. O cliente exibe dentro de <iframe sandbox>, e a CSP desta resposta
 * proíbe qualquer script.
 */
const previewCache = new Map(); // id -> html (pequeno cache em memória)
const PREVIEW_CACHE_MAX = 30;

router.get('/:id/preview', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const material = Number.isInteger(id) ? db.prepare('SELECT * FROM materials WHERE id = ?').get(id) : null;
    if (!material) return res.status(404).json({ error: 'Material não encontrado.' });
    if (!canPreview(material.original_name)) {
      return res.status(415).json({ error: 'Pré-visualização indisponível para este formato. Baixe o arquivo.' });
    }

    let html = previewCache.get(id);
    if (!html) {
      const filePath = storedPath(material.stored_name);
      if (!fs.existsSync(filePath)) return res.status(410).json({ error: 'Arquivo indisponível no servidor.' });
      try {
        html = await buildPreviewPage(filePath, material.original_name, material.title);
      } catch (err) {
        console.error('Falha ao gerar pré-visualização', id, err.message);
        return res.status(422).json({ error: 'Não foi possível ler este arquivo para pré-visualizar. Baixe o arquivo.' });
      }
      if (previewCache.size >= PREVIEW_CACHE_MAX) previewCache.delete(previewCache.keys().next().value);
      previewCache.set(id, html);
    }

    res.set({
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': "default-src 'none'; img-src data:; style-src 'unsafe-inline'; frame-ancestors 'self'; sandbox allow-popups allow-popups-to-escape-sandbox",
      'Cache-Control': 'private, max-age=600',
    });
    res.send(html);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
