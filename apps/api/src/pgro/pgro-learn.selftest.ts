/**
 * Self-test de aprendizado (normalizacao / quando gravar alias).
 * Executar: npx tsx src/pgro/pgro-learn.selftest.ts
 */
import { PgroExtractionAliasKind } from '@prisma/client';
import {
  buildExtraAliasPack,
  shouldLearnAliasForTest,
} from './pgro-learn';
import { normalizeTextKey } from './pgro-parser';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(
  shouldLearnAliasForTest('Calcado de Seguranca', 'Botina de Seguranca') ===
    true,
  'deve aprender quando nomes diferem',
);
assert(
  shouldLearnAliasForTest('Botina de Segurança', 'Botina de Seguranca') ===
    false,
  'nao aprende so por acento',
);
assert(shouldLearnAliasForTest('', 'Botina') === false, 'raw vazio');
assert(shouldLearnAliasForTest('x', '') === false, 'canonical vazio');

assert(
  normalizeTextKey('Botina de Segurança') === 'botina de seguranca',
  'normalize',
);

const pack = buildExtraAliasPack([
  {
    kind: PgroExtractionAliasKind.EPI_NEED,
    rawNormalized: 'calcado de seguranca',
    canonicalName: 'Botina de Seguranca',
    category: null,
  },
  {
    kind: PgroExtractionAliasKind.SECTOR,
    rawNormalized: 'prod',
    canonicalName: 'PRODUCAO',
    category: null,
  },
  {
    kind: PgroExtractionAliasKind.JOB_FUNCTION,
    rawNormalized: 'op linha',
    canonicalName: 'OPERADOR DE LINHA',
    category: null,
  },
  {
    kind: PgroExtractionAliasKind.RISK,
    rawNormalized: 'barulho intenso',
    canonicalName: 'Ruido',
    category: null,
  },
]);

assert(pack.epiNeeds?.length === 1, 'epi pack');
assert(pack.sectors?.length === 1, 'sector pack');
assert(pack.jobFunctions?.length === 1, 'job pack');
assert(pack.risks?.length === 1, 'risk pack');
assert(
  pack.epiNeeds?.[0].canonical === 'Botina de Seguranca',
  'canonical epi',
);

console.log('pgro-learn.selftest OK');
