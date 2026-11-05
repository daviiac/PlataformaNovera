'use strict';

const path = require('node:path');
const { canPreview } = require('./preview');

const NATIVE_KINDS = new Set(['pdf', 'audio', 'video']);

function materialDto(m) {
  const ext = path.extname(m.original_name).slice(1).toLowerCase();
  // Como o material é mostrado na pré-visualização:
  //   native -> o navegador exibe o arquivo (PDF, áudio, vídeo)
  //   html   -> o servidor converte em página (docx, pptx, xlsx, odt, txt)
  //   none   -> só download (formatos antigos)
  let preview = 'none';
  if (NATIVE_KINDS.has(m.kind)) preview = 'native';
  else if (canPreview(m.original_name)) preview = 'html';

  return {
    id: m.id,
    moduleId: m.module_id,
    title: m.title,
    description: m.description,
    originalName: m.original_name,
    ext,
    mimeType: m.mime_type,
    kind: m.kind,
    size: m.size_bytes,
    createdAt: m.created_at,
    preview,
    downloadUrl: `/api/materials/${m.id}/download`,
    viewUrl: preview === 'html' ? `/api/materials/${m.id}/preview` : `/api/materials/${m.id}/download?inline=1`,
  };
}

function moduleDto(m) {
  return {
    id: m.id,
    track: m.track,
    title: m.title,
    description: m.description,
    position: m.position,
  };
}

module.exports = { materialDto, moduleDto };
