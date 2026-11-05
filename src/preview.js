'use strict';

/**
 * Pré-visualização de documentos enviados pelo admin.
 *
 * PDF, áudio e vídeo são exibidos nativamente pelo navegador. Para documentos,
 * o servidor converte o arquivo em uma página HTML estática (sem scripts), que o
 * cliente mostra num <iframe sandbox>:
 *   .docx  -> mammoth (texto, títulos, listas, tabelas e imagens)
 *   .pptx  -> texto e imagens de cada slide
 *   .xlsx  -> planilhas como tabelas
 *   .odt   -> texto
 *   .txt   -> texto
 * Formatos binários antigos (.doc, .ppt, .xls, .rtf) não têm pré-visualização.
 */
const fs = require('node:fs/promises');
const path = require('node:path');
const JSZip = require('jszip');
const mammoth = require('mammoth');

const PREVIEW_EXTS = new Set(['.docx', '.pptx', '.xlsx', '.odt', '.txt']);
const MAX_ROWS = 300;
const MAX_COLS = 40;
const MAX_SHEETS = 10;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const MAX_TEXT_BYTES = 2 * 1024 * 1024;

const IMAGE_MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.bmp': 'image/bmp', '.webp': 'image/webp' };

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function decodeXml(s) {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&');
}

const textRuns = (xml, tag) => [...xml.matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'g'))].map((m) => decodeXml(m[1]));

function canPreview(originalName) {
  return PREVIEW_EXTS.has(path.extname(originalName).toLowerCase());
}

// ---------- Conversores ----------

async function docxToHtml(filePath) {
  const { value } = await mammoth.convertToHtml({ path: filePath });
  // Mantém apenas links seguros.
  return value.replace(/href="([^"]*)"/g, (m, href) => (/^(https?:|mailto:|#)/i.test(href) ? `href="${href}" target="_blank" rel="noopener"` : ''));
}

async function readRels(zip, relsPath) {
  const file = zip.file(relsPath);
  if (!file) return {};
  const xml = await file.async('string');
  const rels = {};
  for (const m of xml.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    const id = /\bId="([^"]+)"/.exec(m[1])?.[1];
    const target = /\bTarget="([^"]+)"/.exec(m[1])?.[1];
    if (id && target) rels[id] = target;
  }
  return rels;
}

async function pptxToHtml(filePath) {
  const zip = await JSZip.loadAsync(await fs.readFile(filePath));
  const slideFiles = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => Number(a.match(/(\d+)\.xml$/)[1]) - Number(b.match(/(\d+)\.xml$/)[1]));

  const parts = [];
  for (const [i, name] of slideFiles.entries()) {
    const xml = await zip.file(name).async('string');
    const paragraphs = [...xml.matchAll(/<a:p>([\s\S]*?)<\/a:p>|<a:p\s[^>]*>([\s\S]*?)<\/a:p>/g)]
      .map((m) => textRuns(m[1] ?? m[2], 'a:t').join(''))
      .filter((t) => t.trim());

    const rels = await readRels(zip, name.replace('slides/', 'slides/_rels/') + '.rels');
    const images = [];
    for (const m of xml.matchAll(/r:embed="([^"]+)"/g)) {
      const target = rels[m[1]];
      if (!target || images.length >= 4) continue;
      const mediaPath = path.posix.normalize(path.posix.join('ppt/slides', target));
      const mime = IMAGE_MIME[path.extname(mediaPath).toLowerCase()];
      const media = zip.file(mediaPath);
      if (!mime || !media) continue;
      const buf = await media.async('nodebuffer');
      if (buf.length <= MAX_IMAGE_BYTES) images.push(`data:${mime};base64,${buf.toString('base64')}`);
    }

    const [title, ...rest] = paragraphs;
    parts.push(`
      <section class="slide">
        <div class="slide-num">Slide ${i + 1}</div>
        ${title ? `<h2>${esc(title)}</h2>` : ''}
        ${rest.map((p) => `<p>${esc(p)}</p>`).join('')}
        ${images.map((src) => `<img src="${src}" alt="">`).join('')}
        ${!paragraphs.length && !images.length ? '<p class="empty">(slide sem texto)</p>' : ''}
      </section>`);
  }
  return parts.join('') || '<p class="empty">A apresentação não tem slides.</p>';
}

function colIndex(ref) {
  const letters = /^[A-Z]+/.exec(ref)?.[0] || 'A';
  return [...letters].reduce((n, c) => n * 26 + (c.charCodeAt(0) - 64), 0) - 1;
}

async function xlsxToHtml(filePath) {
  const zip = await JSZip.loadAsync(await fs.readFile(filePath));
  const shared = [];
  const ssFile = zip.file('xl/sharedStrings.xml');
  if (ssFile) {
    const xml = await ssFile.async('string');
    for (const si of xml.matchAll(/<si>([\s\S]*?)<\/si>/g)) shared.push(textRuns(si[1], 't').join(''));
  }

  const workbook = await zip.file('xl/workbook.xml')?.async('string') || '';
  const rels = await readRels(zip, 'xl/_rels/workbook.xml.rels');
  const sheets = [...workbook.matchAll(/<sheet\b([^>]*)\/?>/g)].map((m) => ({
    name: decodeXml(/\bname="([^"]*)"/.exec(m[1])?.[1] || 'Planilha'),
    target: rels[/\br:id="([^"]+)"/.exec(m[1])?.[1]],
  })).filter((s) => s.target).slice(0, MAX_SHEETS);

  const parts = [];
  for (const sheet of sheets) {
    const sheetPath = sheet.target.startsWith('/') ? sheet.target.slice(1) : path.posix.join('xl', sheet.target);
    const xml = await zip.file(sheetPath)?.async('string');
    if (!xml) continue;

    const rows = [];
    let truncated = false;
    for (const rowMatch of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
      if (rows.length >= MAX_ROWS) { truncated = true; break; }
      const row = [];
      for (const c of rowMatch[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attrs = c[1];
        const inner = c[2] || '';
        const idx = colIndex(/\br="([A-Z]+)\d+"/.exec(attrs)?.[1] || '');
        if (idx >= MAX_COLS) continue;
        const type = /\bt="([^"]+)"/.exec(attrs)?.[1];
        const v = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];
        let value = '';
        if (type === 's') value = shared[Number(v)] ?? '';
        else if (type === 'inlineStr') value = textRuns(inner, 't').join('');
        else if (type === 'b') value = v === '1' ? 'VERDADEIRO' : 'FALSO';
        else if (v !== undefined) value = decodeXml(v);
        row[idx] = value;
      }
      rows.push(row);
    }
    const width = Math.max(0, ...rows.map((r) => r.length));
    const body = rows.map((r) => `<tr>${Array.from({ length: width }, (_, i) => `<td>${esc(r[i] ?? '')}</td>`).join('')}</tr>`).join('');
    parts.push(`
      <h2>${esc(sheet.name)}</h2>
      ${rows.length ? `<div class="table-wrap"><table>${body}</table></div>` : '<p class="empty">Planilha vazia.</p>'}
      ${truncated ? `<p class="empty">Mostrando as primeiras ${MAX_ROWS} linhas. Baixe o arquivo para ver tudo.</p>` : ''}`);
  }
  return parts.join('') || '<p class="empty">Nenhuma planilha encontrada.</p>';
}

async function odtToHtml(filePath) {
  const zip = await JSZip.loadAsync(await fs.readFile(filePath));
  const xml = await zip.file('content.xml')?.async('string') || '';
  const blocks = [...xml.matchAll(/<text:(h|p)\b[^>]*>([\s\S]*?)<\/text:\1>/g)].map((m) => {
    const text = decodeXml(m[2].replace(/<text:tab\/>/g, '\t').replace(/<text:line-break\/>/g, '\n').replace(/<[^>]+>/g, ''));
    return m[1] === 'h' ? `<h2>${esc(text)}</h2>` : `<p>${esc(text) || '&nbsp;'}</p>`;
  });
  return blocks.join('') || '<p class="empty">Documento sem texto.</p>';
}

async function txtToHtml(filePath) {
  const handle = await fs.open(filePath, 'r');
  try {
    const buf = Buffer.alloc(MAX_TEXT_BYTES);
    const { bytesRead } = await handle.read(buf, 0, MAX_TEXT_BYTES, 0);
    return `<pre>${esc(buf.subarray(0, bytesRead).toString('utf8'))}</pre>`;
  } finally {
    await handle.close();
  }
}

const CONVERTERS = { '.docx': docxToHtml, '.pptx': pptxToHtml, '.xlsx': xlsxToHtml, '.odt': odtToHtml, '.txt': txtToHtml };

const PAGE_CSS = `
  *{box-sizing:border-box}
  html{background:#efeaf7}
  body{margin:0;padding:28px 16px;font:15px/1.65 "Segoe UI",system-ui,-apple-system,sans-serif;color:#1d1530}
  .page{max-width:820px;margin:0 auto;background:#fff;border-radius:12px;padding:48px 56px;box-shadow:0 10px 30px rgba(46,27,68,.12)}
  h1,h2,h3,h4{color:#2e1b44;line-height:1.25;margin:1.3em 0 .5em}
  h1:first-child,h2:first-child{margin-top:0}
  img{max-width:100%;height:auto;border-radius:6px;margin:8px 0}
  table{border-collapse:collapse;margin:12px 0;font-size:14px}
  td,th{border:1px solid #ddd3ee;padding:6px 10px;vertical-align:top;white-space:pre-wrap}
  tr:nth-child(odd) td{background:#faf8fd}
  .table-wrap{overflow:auto;max-width:100%}
  pre{white-space:pre-wrap;word-wrap:break-word;font:14px/1.6 ui-monospace,Consolas,monospace;margin:0}
  a{color:#5e17b0}
  .slide{border:1px solid #e6def3;border-radius:12px;padding:28px 32px;margin-bottom:22px;aspect-ratio:auto}
  .slide-num{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#8a7fa3;margin-bottom:10px}
  .slide h2{margin-top:0}
  .empty{color:#8a7fa3;font-style:italic}
  @media (max-width:640px){.page{padding:24px 20px}body{padding:12px 8px}}
`;

/** Gera a página HTML de pré-visualização (sem scripts). */
async function buildPreviewPage(filePath, originalName, title) {
  const ext = path.extname(originalName).toLowerCase();
  const convert = CONVERTERS[ext];
  if (!convert) return null;
  const body = await convert(filePath);
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${PAGE_CSS}</style></head><body><main class="page">${body}</main></body></html>`;
}

module.exports = { canPreview, buildPreviewPage, PREVIEW_EXTS };
