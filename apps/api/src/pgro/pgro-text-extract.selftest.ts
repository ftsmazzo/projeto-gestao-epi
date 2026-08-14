import assert from 'node:assert/strict';
import { detectPgroDocumentKind } from './pgro-text-extract';

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

let threw = false;
try {
  detectPgroDocumentKind(fakeFile('PGR.doc', 'application/msword'));
} catch {
  threw = true;
}
assert.equal(threw, true);

console.log('pgro-text-extract.selftest: ok');
