'use strict';

/**
 * Armazenamento dos materiais.
 *
 *  - Produção: Supabase Storage (bucket privado). O navegador do admin envia o arquivo
 *    DIRETO para o Supabase com uma URL de upload assinada — assim o arquivo não passa
 *    pela função da Vercel (limite de 4,5 MB por requisição). Downloads usam URLs
 *    assinadas de curta duração, geradas só para usuários autenticados.
 *  - Desenvolvimento/testes: disco local (storage/uploads), com o mesmo fluxo:
 *    o navegador faz PUT do arquivo numa rota do próprio servidor (só admin).
 *
 * Os objetos são gravados como "materials/<uuid>.<ext>"; o nome original fica só no banco.
 */
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const config = require('./config');

/** Lista branca de extensões. O tipo MIME vem desta tabela, nunca do navegador. */
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
const OBJECT_PATH_RE = /^materials\/[0-9a-f-]{36}\.[a-z0-9]{2,5}$/;
const MAX_BYTES = config.MAX_UPLOAD_MB * 1024 * 1024;

const extOf = (filename) => path.extname(filename || '').toLowerCase();
const isValidObjectPath = (p) => typeof p === 'string' && OBJECT_PATH_RE.test(p) && Boolean(ALLOWED[extOf(p)]);
const newObjectPath = (ext) => `materials/${crypto.randomUUID()}${ext}`;

function contentDisposition(type, filename) {
  const ascii = filename.replace(/[^\x20-\x7e]|["\\]/g, '_');
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

// ---------------------------------------------------------------------------
// Supabase Storage
// ---------------------------------------------------------------------------
function supabaseProvider() {
  const { createClient } = require('@supabase/supabase-js');
  const client = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const bucket = () => client.storage.from(config.SUPABASE_BUCKET);
  const fail = (what, error) => { throw new Error(`Supabase Storage (${what}): ${error.message || error}`); };

  return {
    name: 'supabase',
    origin: new URL(config.SUPABASE_URL).origin,

    async createUpload(objectPath, mime) {
      const { data, error } = await bucket().createSignedUploadUrl(objectPath);
      if (error) fail('upload', error);
      return { url: data.signedUrl, method: 'PUT', headers: { 'Content-Type': mime, 'x-upsert': 'false' } };
    },

    async stat(objectPath) {
      const { data, error } = await bucket().info(objectPath);
      if (error || !data) return null;
      return { size: Number(data.size ?? data.metadata?.size ?? 0) };
    },

    async read(objectPath) {
      const { data, error } = await bucket().download(objectPath);
      if (error) fail('download', error);
      return Buffer.from(await data.arrayBuffer());
    },

    async remove(objectPath) {
      const { error } = await bucket().remove([objectPath]);
      if (error) console.error('Falha ao remover do Storage', objectPath, error.message);
    },

    /** Redireciona para uma URL assinada (válida por 2 min para download, 1 h para assistir). */
    async send(res, material, { inline }) {
      const options = inline ? {} : { download: material.original_name };
      const { data, error } = await bucket().createSignedUrl(material.stored_name, inline ? 3600 : 120, options);
      if (error) fail('link', error);
      res.set('Cache-Control', 'no-store');
      res.redirect(302, data.signedUrl);
    },

    async ensureBucket() {
      const { data } = await client.storage.getBucket(config.SUPABASE_BUCKET);
      if (data) return false;
      const { error } = await client.storage.createBucket(config.SUPABASE_BUCKET, {
        public: false,
        fileSizeLimit: `${config.MAX_UPLOAD_MB}MB`,
      });
      if (error) fail('criar bucket', error);
      return true;
    },
  };
}

// ---------------------------------------------------------------------------
// Disco local (desenvolvimento e testes)
// ---------------------------------------------------------------------------
function localProvider() {
  const root = path.resolve(config.UPLOAD_DIR);
  const resolve = (objectPath) => {
    if (!isValidObjectPath(objectPath)) throw new Error('Caminho de arquivo inválido');
    return path.join(root, path.basename(objectPath));
  };

  return {
    name: 'local',
    origin: null,

    async createUpload(objectPath, mime) {
      return { url: `/api/admin/uploads/local/${path.basename(objectPath)}`, method: 'PUT', headers: { 'Content-Type': mime } };
    },

    /** Recebe o corpo do PUT (rota só de admin) e grava em disco, respeitando o limite. */
    async receive(req, objectPath) {
      await fsp.mkdir(root, { recursive: true });
      const target = resolve(objectPath);
      const tmp = `${target}.part`;
      let size = 0;
      await new Promise((ok, ko) => {
        const out = fs.createWriteStream(tmp, { flags: 'wx' });
        req.on('data', (chunk) => {
          size += chunk.length;
          if (size > MAX_BYTES) {
            req.destroy();
            out.destroy();
            ko(Object.assign(new Error(`Arquivo maior que o limite de ${config.MAX_UPLOAD_MB} MB.`), { status: 413 }));
          }
        });
        req.on('error', ko);
        out.on('error', ko);
        out.on('finish', ok);
        req.pipe(out);
      }).catch(async (err) => {
        await fsp.rm(tmp, { force: true });
        throw err;
      });
      await fsp.rename(tmp, target);
      return { size };
    },

    async stat(objectPath) {
      try {
        return { size: (await fsp.stat(resolve(objectPath))).size };
      } catch {
        return null;
      }
    },

    read: (objectPath) => fsp.readFile(resolve(objectPath)),

    async remove(objectPath) {
      await fsp.rm(resolve(objectPath), { force: true });
    },

    async send(res, material, { inline }) {
      const filePath = resolve(material.stored_name);
      if (!fs.existsSync(filePath)) return res.status(410).json({ error: 'Arquivo indisponível no servidor.' });
      res.set({
        'Content-Type': material.mime_type,
        'Content-Disposition': contentDisposition(inline ? 'inline' : 'attachment', material.original_name),
        'Cache-Control': 'private, max-age=3600',
      });
      // sendFile dá suporte a Range (avançar em áudio/vídeo).
      await new Promise((ok, ko) => res.sendFile(filePath, { headers: { 'Content-Type': material.mime_type } }, (e) => (e ? ko(e) : ok())));
    },

    async ensureBucket() {
      await fsp.mkdir(root, { recursive: true });
      return false;
    },
  };
}

const useSupabase = Boolean(config.SUPABASE_URL && config.SUPABASE_SERVICE_ROLE_KEY);
if (config.IS_VERCEL && !useSupabase) {
  console.error('ATENÇÃO: SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes — na Vercel os arquivos não serão persistidos.');
}

const storage = useSupabase ? supabaseProvider() : localProvider();

module.exports = { storage, ALLOWED, INLINE_KINDS, MAX_BYTES, extOf, isValidObjectPath, newObjectPath };
