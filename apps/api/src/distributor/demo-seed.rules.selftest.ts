/**
 * Uso: npx --yes tsx src/distributor/demo-seed.rules.selftest.ts
 */
import {
  DISTRIBUTOR_DEMO_PRODUCTS,
  demoSeedSummary,
} from './demo-seed.rules';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

assert(DISTRIBUTOR_DEMO_PRODUCTS.length === 10, 'dez produtos');
const gtins = new Set(DISTRIBUTOR_DEMO_PRODUCTS.map((row) => row.gtin));
assert(gtins.size === 10, 'gtins unicos');
const skus = new Set(DISTRIBUTOR_DEMO_PRODUCTS.map((row) => row.internalSku));
assert(skus.size === 10, 'skus unicos');
for (const row of DISTRIBUTOR_DEMO_PRODUCTS) {
  assert(/^\d{13}$/.test(row.gtin), `gtin ${row.internalSku}`);
  assert(row.sizes.length >= 1, `sizes ${row.internalSku}`);
  assert(row.openingQty > 0, `qty ${row.internalSku}`);
}
const summary = demoSeedSummary(['A', 'B']);
assert(summary.createdCount === 2 && summary.hint.includes('7891000100001'), 'summary');

console.log('demo-seed.rules.selftest ok');
