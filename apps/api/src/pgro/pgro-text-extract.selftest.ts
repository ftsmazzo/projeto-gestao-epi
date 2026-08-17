import assert from 'node:assert/strict';
import WordExtractor from 'word-extractor';
import {
  detectPgroDocumentKind,
  htmlToStructuredText,
} from './pgro-text-extract';

function fakeFile(
  name: string,
  mimetype: string,
): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: name,
    encoding: '7bit',
    mimetype,
    size: 10,
    buffer: Buffer.from('x'),
    stream: null as never,
    destination: '',
    filename: name,
    path: '',
  };
}

assert.equal(
  detectPgroDocumentKind(
    fakeFile(
      'PGR.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ),
  ),
  'DOCX',
);
assert.equal(
  detectPgroDocumentKind(fakeFile('PGR.pdf', 'application/pdf')),
  'PDF',
);

assert.equal(
  detectPgroDocumentKind(fakeFile('PGR.doc', 'application/msword')),
  'DOC',
);
assert.equal(typeof WordExtractor, 'function');

const structured = htmlToStructuredText(`
<p>Caracterização do GHE 01 – Soldador</p>
<table><tr><td>SETOR</td><td>CALDEIRARIA</td></tr>
<tr><td>FUNÇÃO</td><td>Soldador</td></tr></table>
<p>APRHO do GHE 01</p>
`);
assert.match(structured, /Caracteriza[cç][aã]o\s+do\s+GHE\s*01/i);
assert.match(structured, /APRHO\s+do\s+GHE\s*01/i);
assert.ok(structured.includes('\n'), 'html precisa gerar quebras de linha');

console.log('pgro-text-extract.selftest: ok');
