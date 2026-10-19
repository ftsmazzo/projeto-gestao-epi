/**
 * Teto de desconto do orcamento e total concedido.
 * Uso: npx --yes tsx src/distributor/quote.rules.selftest.ts
 */
import {
  QuoteRuleError,
  decideQuote,
  lineGrantedCents,
  percentToBps,
  sumGrantedCents,
} from './quote.rules';

function assert(name: string, ok: boolean) {
  if (!ok) throw new Error(`Falhou: ${name}`);
}

assert('3% vira 300 basis points', percentToBps(3) === 300);
assert('2,5% vira 250 basis points', percentToBps(2.5) === 250);

assert(
  'desconto de 10% sobre 100 reais e 2 pecas',
  lineGrantedCents({
    quantity: 2,
    unitPriceCents: 10000,
    discountBps: 1000,
  }) === 2000,
);

const inside = decideQuote({
  sellerMaxDiscountBps: 1500,
  lines: [
    { quantity: 1, unitPriceCents: 5000, discountBps: 1000 },
  ],
});
assert('dentro do teto segue', inside.status === 'APPROVED' && inside.grantedCents === 500);

const above = decideQuote({
  sellerMaxDiscountBps: 1500,
  lines: [
    { quantity: 1, unitPriceCents: 5000, discountBps: 2000 },
  ],
});
assert('acima do teto espera aprovacao', above.status === 'PENDING_APPROVAL');

const zeroCeiling = decideQuote({
  sellerMaxDiscountBps: 0,
  lines: [{ quantity: 1, unitPriceCents: 1000, discountBps: 0 }],
});
assert('sem desconto e teto zero segue', zeroCeiling.status === 'APPROVED');

let threw = false;
try {
  decideQuote({
    sellerMaxDiscountBps: 0,
    lines: [{ quantity: 1, unitPriceCents: 1000, discountBps: 100 }],
  });
} catch (error) {
  threw = error instanceof QuoteRuleError;
}
assert(
  'desconto acima do teto zero espera aprovacao',
  decideQuote({
    sellerMaxDiscountBps: 0,
    lines: [{ quantity: 1, unitPriceCents: 1000, discountBps: 100 }],
  }).status === 'PENDING_APPROVAL' && !threw,
);

assert(
  'relatorio soma so o aprovado',
  sumGrantedCents([
    { status: 'APPROVED', grantedCents: 1500 },
    { status: 'PENDING_APPROVAL', grantedCents: 9000 },
    { status: 'REJECTED', grantedCents: 4000 },
    { status: 'APPROVED', grantedCents: 250 },
  ]) === 1750,
);

console.log('quote.rules.selftest ok');
