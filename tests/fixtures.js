'use strict';

// Gera arquivos Office mínimos (válidos) para testar a pré-visualização.
const JSZip = require('jszip');

const CT = (overrides) => `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  ${overrides}
</Types>`;

const rels = (items) => `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${items.map(([id, type, target]) => `<Relationship Id="${id}" Type="${type}" Target="${target}"/>`).join('')}
</Relationships>`;

const OFFICE_DOC = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument';

async function makeDocx() {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', CT('<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'));
  zip.file('_rels/.rels', rels([['rId1', OFFICE_DOC, 'word/document.xml']]));
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
  <w:p><w:r><w:t>Verb to be &amp; pronouns</w:t></w:r></w:p>
  <w:p><w:r><w:t>I am a student. &lt;script&gt;alert(1)&lt;/script&gt;</w:t></w:r></w:p>
</w:body></w:document>`);
  return zip.generateAsync({ type: 'nodebuffer' });
}

async function makePptx() {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', CT('<Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>'));
  const slide = (title, body) => `<?xml version="1.0" encoding="UTF-8"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree>
  <p:sp><p:txBody><a:p><a:r><a:t>${title}</a:t></a:r></a:p><a:p><a:r><a:t>${body}</a:t></a:r></a:p></p:txBody></p:sp>
</p:spTree></p:cSld></p:sld>`;
  zip.file('ppt/slides/slide1.xml', slide('Past simple', 'I went to school'));
  zip.file('ppt/slides/slide2.xml', slide('Irregular verbs', 'go - went - gone'));
  return zip.generateAsync({ type: 'nodebuffer' });
}

async function makeXlsx() {
  const zip = new JSZip();
  const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  zip.file('[Content_Types].xml', CT(''));
  zip.file('_rels/.rels', rels([['rId1', OFFICE_DOC, 'xl/workbook.xml']]));
  zip.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${R}"><sheets><sheet name="Vocabulário" sheetId="1" r:id="rId1"/></sheets></workbook>`);
  zip.file('xl/_rels/workbook.xml.rels', rels([['rId1', `${R}/worksheet`, 'worksheets/sheet1.xml']]));
  zip.file('xl/sharedStrings.xml', `<?xml version="1.0" encoding="UTF-8"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><t>English</t></si><si><t>Português</t></si><si><t>apple</t></si><si><t>maçã</t></si></sst>`);
  zip.file('xl/worksheets/sheet1.xml', `<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>
  <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>
  <row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2" t="s"><v>3</v></c><c r="D2"><v>42</v></c></row>
</sheetData></worksheet>`);
  return zip.generateAsync({ type: 'nodebuffer' });
}

module.exports = { makeDocx, makePptx, makeXlsx };
