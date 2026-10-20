/**
 * Uso: npx --yes tsx src/distributor/field-quote.rules.selftest.ts
 */
import {
  FieldQuoteRuleError,
  bpsToPercentLabel,
  buildFieldQuoteLines,
  decideFieldQuote,
  normalizeFieldVisitSummary,
  normalizeFieldVisitedAt,
} from './field-quote.rules';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

assert(
  normalizeFieldVisitSummary('') === 'Orcamento montado em visita.',
  'resumo padrao',
);
assert(normalizeFieldVisitedAt('2026-10-20').toISOString().startsWith('2026-10-20'), 'data');

const lines = buildFieldQuoteLines([
  {
    variantId: 'v1',
    quantity: 2,
    unitPriceCents: 1000,
    discountPercent: 5,
  },
]);
assert(lines[0]!.discountBps === 500, 'bps');

const inside = decideFieldQuote({
  lines,
  sellerMaxDiscountBps: 500,
});
assert(inside.status === 'APPROVED', 'dentro do teto');

const above = decideFieldQuote({
  lines,
  sellerMaxDiscountBps: 300,
});
assert(above.status === 'PENDING_APPROVAL', 'acima do teto');
assert(bpsToPercentLabel(300) === 3, 'label');

let bad = false;
try {
  buildFieldQuoteLines([
    { variantId: 'v1', quantity: 1, unitPriceCents: 100, discountPercent: 120 },
  ]);
} catch (error) {
  bad = error instanceof FieldQuoteRuleError;
}
assert(bad, 'desconto invalido');

console.log('field-quote.rules.selftest ok');
