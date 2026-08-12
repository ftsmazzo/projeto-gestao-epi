/**
 * Self-test do diff de reimportacao PGR.
 * Executar: npx tsx src/pgro/pgro-diff.selftest.ts
 */
import {
  assessPgroCompanyMatch,
  buildPgroStructureDiff,
  functionKey,
} from './pgro-diff';

function assert(cond: unknown, message: string) {
  if (!cond) {
    throw new Error(message);
  }
}

const existing = [
  {
    name: 'PRODUCAO',
    isActive: true,
    operationalUnitId: null,
    jobs: [
      { name: 'AUXILIAR', isActive: true, workerCount: 3 },
      { name: 'ENCARREGADO', isActive: true, workerCount: 1 },
    ],
  },
  {
    name: 'ADMINISTRATIVO',
    isActive: true,
    operationalUnitId: null,
    jobs: [{ name: 'ASSISTENTE', isActive: true, workerCount: 2 }],
  },
  {
    name: 'MANUTENCAO',
    isActive: false,
    operationalUnitId: null,
    jobs: [{ name: 'MECANICO', isActive: false, workerCount: 0 }],
  },
  {
    name: 'UNIDADE LOJA',
    isActive: true,
    operationalUnitId: 'unit-1',
    jobs: [{ name: 'VENDEDOR', isActive: true, workerCount: 4 }],
  },
];

const diff = buildPgroStructureDiff({
  existingSectors: existing,
  parsedSectors: [{ name: 'Producao' }, { name: 'Manutencao' }],
  parsedFunctions: [
    { name: 'Auxiliar', sectorName: 'Producao' },
    { name: 'Soldador', sectorName: 'Producao' },
    { name: 'Mecanico', sectorName: 'Manutencao' },
  ],
});

assert(diff.sectorsAdded.length === 0, 'nenhum setor novo');
assert(
  diff.sectorsKept.some((s) => s.name === 'PRODUCAO'),
  'producao permanece',
);
assert(
  diff.sectorsReactivated.some((s) => s.name === 'MANUTENCAO'),
  'manutencao reativa',
);
assert(
  diff.sectorsToArchive.some((s) => s.name === 'ADMINISTRATIVO'),
  'administrativo arquiva',
);
assert(
  !diff.sectorsToArchive.some((s) => s.name === 'UNIDADE LOJA'),
  'setor de unidade nao entra no diff',
);
assert(
  diff.functionsAdded.some((f) => f.name === 'Soldador'),
  'soldador e novo',
);
assert(
  diff.functionsKept.some((f) => f.name === 'AUXILIAR'),
  'auxiliar permanece',
);
assert(
  diff.functionsReactivated.some((f) => f.name === 'MECANICO'),
  'mecanico reativa',
);
assert(
  diff.functionsToArchive.some(
    (f) => f.name === 'ENCARREGADO' && f.workerCount === 1,
  ),
  'encarregado arquiva com trabalhador',
);
assert(
  diff.functionsToArchive.some(
    (f) => f.name === 'ASSISTENTE' && f.workerCount === 2,
  ),
  'assistente arquiva',
);
assert(
  functionKey('Producao', 'Auxiliar') === functionKey('PRODUCAO', 'AUXILIAR'),
  'chave de funcao ignora acento/caixa',
);

const mismatch = assessPgroCompanyMatch({
  clientCnpj: '27.090.425/0001-95',
  parsedCnpj: '00.000.000/0001-91',
});
assert(!mismatch.canConfirm && mismatch.cnpjMatches === false, 'cnpj bloqueia');

const match = assessPgroCompanyMatch({
  clientCnpj: '27090425000195',
  parsedCnpj: '27.090.425/0001-95',
});
assert(match.canConfirm && match.cnpjMatches === true, 'cnpj confere');

const missing = assessPgroCompanyMatch({
  clientCnpj: '27090425000195',
  parsedCnpj: null,
});
assert(missing.canConfirm && missing.cnpjMatches === null, 'cnpj ausente avisa');

console.log('pgro-diff.selftest: ok');
