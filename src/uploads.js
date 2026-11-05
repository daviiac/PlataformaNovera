'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const multer = require('multer');
const { UPLOAD_DIR, MAX_UPLOAD_MB } = require('./config');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

/**
 * Lista branca de extensões aceitas. O tipo MIME servido depois vem desta
 * tabela, nunca do que o navegador declarou no upload.
 */
const ALLOWED = {
  '.pdf': { mime: 'application/pdf', kind: 'pdf' },
  '.mp3': { mime: 'audio/mpeg', kind: 'audio' },
  '.wav': { mime: 'audio/wav', kind: 'audio' },
  '.ogg': { mime: 'audio/ogg', kind: 'audio' },
  '.m4a': { mime: 'audio/mp4', kind: 'audio' },
  '.mp4': { mime: 'video/mp4', kind: 'video' },
  '.webm': { mime: 'video/webm', kind: 'video' },
  '.mov': { mime: 'video/quicktime', kind: 'video' },
  '.doc': { mime: 'application/msword', kind: 'document' },
  '.docx': { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', kind: 'document' },
  '.odt': { mime: 'application/vnd.oasis.opendocument.text', kind: 'document' },
  '.rtf': { mime: 'application/rtf', kind: 'document' },
  '.txt': { mime: 'text/plain; charset=utf-8', kind: 'document' },
  '.ppt': { mime: 'application/vnd.ms-powerpoint', kind: 'document' },
  '.pptx': { mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', kind: 'document' },
  '.xls': { mime: 'application/vnd.ms-excel', kind: 'document' },
  '.xlsx': { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', kind: 'document' },
};

const INLINE_KINDS = new Set(['pdf', 'audio', 'video']);

const extOf = (filename) => path.extname(filename || '').toLowerCase();

class BadRequestError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    // Nome aleatório: o nome original nunca vira caminho no disco.
    filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}${extOf(file.originalname)}`),
  }),
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024, files: 1, fields: 10 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED[extOf(file.originalname)]) {
      return cb(new BadRequestError(
        `Tipo de arquivo não permitido. Aceitos: ${Object.keys(ALLOWED).join(', ')}`,
      ));
    }
    cb(null, true);
  },
});

/** Resolve o caminho do arquivo garantindo que ele fica dentro de UPLOAD_DIR. */
function storedPath(storedName) {
  const full = path.resolve(UPLOAD_DIR, storedName);
  if (path.dirname(full) !== path.resolve(UPLOAD_DIR)) throw new Error('Caminho de arquivo inválido');
  return full;
}

function removeStoredFile(storedName) {
  try {
    fs.unlinkSync(storedPath(storedName));
  } catch (err) {
    if (err.code !== 'ENOENT') console.error('Falha ao remover arquivo', storedName, err.message);
  }
}

module.exports = { upload, ALLOWED, INLINE_KINDS, extOf, storedPath, removeStoredFile, BadRequestError };
