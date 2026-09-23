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
