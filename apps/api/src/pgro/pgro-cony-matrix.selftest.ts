import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseConyEpiMatrixText } from './pgro-cony-matrix';
import { parsePgroText } from './pgro-parser';
import { resolvePgroExtractionProfile } from './pgro-extraction-profiles';

assert.equal(resolvePgroExtractionProfile(null), 'INSEG_OFFICIAL');
assert.equal(resolvePgroExtractionProfile(''), 'INSEG_OFFICIAL');
assert.equal(resolvePgroExtractionProfile('CONY_EPI_MATRIX'), 'CONY_EPI_MATRIX');
assert.equal(resolvePgroExtractionProfile('cony'), 'CONY_EPI_MATRIX');

const extractPath = resolve(
  process.cwd(),
  '../../tmp-cert-export/pgr-escritorio-extract.txt',
);
const altPath = resolve(
  process.cwd(),
  '../../../tmp-cert-export/pgr-escritorio-extract.txt',
);
const textPath = existsSync(extractPath)
  ? extractPath
  : existsSync(altPath)
    ? altPath
    : null;

if (!textPath) {
  console.log(
    'pgro-cony-matrix.selftest: skip (sem pgr-escritorio-extract.txt) — perfil resolve ok',
  );
  process.exit(0);
}

const text = readFileSync(textPath, 'utf8');
const cony = parseConyEpiMatrixText(text);

assert.ok(cony.functions.length >= 15, `funcoes: ${cony.functions.length}`);
assert.ok(cony.sectors.length >= 1, `setores: ${cony.sectors.length}`);
assert.ok(
  cony.sectors.some((s) => /administrativo/i.test(s.name)),
  `setores: ${cony.sectors.map((s) => s.name).join('|')}`,
);
assert.ok(
  cony.functions.some((f) => /servi[cç]os\s+gerais/i.test(f.name)),
  'faltou cargo limpeza',
);
assert.ok(cony.epiNeeds.length >= 5, `epis: ${cony.epiNeeds.length}`);

assert.match(
  cony.company.legalName ?? '',
  /CONY\s+ENGENHARIA\s+LTDA/i,
  `razao: ${cony.company.legalName}`,
);
assert.match(
  cony.company.tradeName ?? '',
  /CONY\s+ENGENHARIA/i,
  `fantasia: ${cony.company.tradeName}`,
);
assert.equal(cony.company.cnpj, '41167347000100');
assert.match(
  cony.company.addressLine ?? '',
  /Luiz\s+Ramalho/i,
  `endereco: ${cony.company.addressLine}`,
);
assert.match(cony.company.city ?? '', /Macei[oó]/i, `cidade: ${cony.company.city}`);
assert.equal(cony.company.state, 'AL');
assert.ok(cony.company.cnae, `cnae: ${cony.company.cnae}`);
assert.equal(cony.company.riskGrade, '3');
assert.match(
  cony.company.contactEmail ?? '',
  /engenhariasstcony@gmail\.com/i,
);
assert.ok(
  (cony.company.contactPhone ?? '').includes('8233344099') ||
    (cony.company.contactPhone ?? '').includes('33344099'),
  `fone: ${cony.company.contactPhone}`,
);

for (const epi of cony.epiNeeds) {
  assert.ok(
    !/\d{2}\.\d{3}|\b\d{4,5}\b/.test(epi.extractedText),
    `EPI com CA no texto: ${epi.extractedText}`,
  );
  assert.ok(
    !/\d{2}\.\d{3}|\b\d{4,5}\b/.test(epi.suggestedName),
    `EPI com CA no nome: ${epi.suggestedName}`,
  );
}
assert.ok(
  cony.epiNeeds.some((e) => /bota de borracha/i.test(e.suggestedName)),
);
assert.ok(
  cony.epiNeeds.some((e) =>
    /cal[cç]a de seguran[cç]a|calca de seguranca/i.test(e.suggestedName),
  ),
  `calca: ${cony.epiNeeds.map((e) => e.suggestedName).join('|')}`,
);
assert.ok(
  cony.epiNeeds.some((e) => /capa de chuva/i.test(e.suggestedName)),
);
assert.ok(
  cony.epiNeeds.some((e) => /luva latex|luva látex/i.test(e.suggestedName)),
  `latex: ${cony.epiNeeds.map((e) => e.suggestedName).join('|')}`,
);
const limpezaFns = new Set(
  cony.functions
    .filter((f) => /GHE\s*02/i.test(f.gheName ?? ''))
    .map((f) => f.name),
);
const episForLimpeza = cony.epiNeeds.filter((e) =>
  e.functionNames.some((n) => limpezaFns.has(n)),
);
assert.ok(
  episForLimpeza.length >= 3,
  `EPIs da limpeza: ${episForLimpeza.map((e) => e.suggestedName).join('|')}`,
);

// Path Inseg no mesmo texto nao deve ser usado como “oficial” neste selftest —
// so garante que o parser oficial ainda roda sem throw.
const inseg = parsePgroText(text);
assert.ok(inseg.textExtractable);

console.log(
  `pgro-cony-matrix.selftest: ok (funcoes=${cony.functions.length}, epis=${cony.epiNeeds.length}, cobertura=${cony.coverage?.coverageOk})`,
);
