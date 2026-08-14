import assert from 'node:assert/strict';
import {
  decodeCsvBytes,
  fixUtf8Mojibake,
  normalizeCsvImportText,
  resolveCsvImportInput,
  stripOrphanDiacritics,
} from './csv-text-encoding';

function run() {
  assert.equal(fixUtf8Mojibake('JosÃ©'), 'José');
  assert.equal(fixUtf8Mojibake('ProduÃ§Ã£o'), 'Produção');
  assert.equal(fixUtf8Mojibake('funÃ§Ã£o'), 'função');

  assert.equal(stripOrphanDiacritics('Jose´'), 'Jose');
  assert.equal(stripOrphanDiacritics('Maria^'), 'Maria');
  assert.equal(stripOrphanDiacritics('Joao~Silva'), 'JoaoSilva');
  assert.equal(stripOrphanDiacritics('José'), 'José');
  assert.equal(stripOrphanDiacritics('Produção'), 'Produção');

  const win1252 = Buffer.from(
    [0x6e, 0x6f, 0x6d, 0x65, 0x3b, 0x66, 0x75, 0x6e, 0xe7, 0xe3, 0x6f],
  ); // nome;função in windows-1252
  const decoded = decodeCsvBytes(win1252);
  assert.match(decoded, /função/i);

  const utf8Bom = Buffer.from('\uFEFFnome;função\nJosé;Operação', 'utf8');
  assert.match(decodeCsvBytes(utf8Bom), /José/);

  const fromBase64 = resolveCsvImportInput({
    csvBase64: win1252.toString('base64'),
  });
  assert.match(fromBase64, /função/i);

  const fromText = normalizeCsvImportText('nome;funÃ§Ã£o\nJosÃ©;ProduÃ§Ã£o');
  assert.match(fromText, /função/);
  assert.match(fromText, /José/);

  console.log('csv-text-encoding.selftest: ok');
}

run();
