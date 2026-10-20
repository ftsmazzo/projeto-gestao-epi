/**
 * Uso: npx --yes tsx src/distributor/plus.rules.selftest.ts
 */
import {
  PlusRuleError,
  assertPlusContractActive,
  assertPlusMappingTargets,
  pickPlusMappedLines,
  plusShipmentNotes,
} from './plus.rules';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

assertPlusContractActive('ACTIVE');
let revoked = false;
try {
  assertPlusContractActive('REVOKED');
} catch (error) {
  revoked = error instanceof PlusRuleError;
}
assert(revoked, 'revogado');

const targets = assertPlusMappingTargets({
  epiItemId: '  epi-1 ',
  epiVariantId: '  ',
});
assert(targets.epiItemId === 'epi-1', 'epiItem');
assert(targets.epiVariantId === null, 'variante vazia');

const mapped = pickPlusMappedLines(
  [
    { variantId: 'v1', quantity: 2 },
    { variantId: 'v2', quantity: 1 },
  ],
  [{ variantId: 'v1', epiItemId: 'e1', epiVariantId: null }],
);
assert(mapped.length === 1 && mapped[0].epiItemId === 'e1', 'mapeadas');
assert(
  plusShipmentNotes({
    series: '1',
    number: 42,
    distributorName: 'Dist EPI',
  }).includes('1/42'),
  'nota',
);

console.log('plus.rules.selftest ok');
