/**
 * Uso: npx --yes tsx src/distributor/payable.rules.selftest.ts
 */
import {
  PayableRuleError,
  assertCancelPayable,
  assertMarkPayablePaid,
  assertPayableAmount,
  parseDueDay,
  sumCostLines,
} from './payable.rules';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

assert(
  sumCostLines([
    { quantity: 2, unitCostCents: 1500 },
    { quantity: 1, unitCostCents: null },
  ]) === 3000,
  'soma ignora custo nulo como zero',
);
assert(assertPayableAmount(0) === 0, 'zero ok');

let bad = false;
try {
  assertPayableAmount(-1);
} catch (error) {
  bad = error instanceof PayableRuleError;
}
assert(bad, 'negativo rejeitado');

assertMarkPayablePaid('OPEN');
let notOpen = false;
try {
  assertMarkPayablePaid('PAID');
} catch (error) {
  notOpen = error instanceof PayableRuleError;
}
assert(notOpen, 'pago nao remarca');

assertCancelPayable('OPEN');
assert(parseDueDay('2026-11-01')?.toISOString().startsWith('2026-11-01') === true, 'due day');
assert(parseDueDay(null) === null, 'due vazio');

console.log('payable.rules.selftest ok');
