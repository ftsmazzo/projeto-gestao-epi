import assert from 'assert';
import {
  parseInvoiceText,
  parseMoneyToCents,
} from './invoice-extract';

function run() {
  assert.strictEqual(parseMoneyToCents('12,50'), 1250);
  assert.strictEqual(parseMoneyToCents('1.234,56'), 123456);

  const sample = `
DANFE NF-e 123456
Emitente: Distribuidora EPI Sul Ltda
PRODUTO
LUVA NITRILICA CA 12345 10 12,50 125,00
PROTETOR AURICULAR 5 3,90 19,50
Valor Total 144,50
`;

  const result = parseInvoiceText(sample);
  assert.ok(result.ok, result.message);
  assert.ok(result.lines.length >= 1);
  assert.ok(result.suggested?.unitCostCents != null);
  assert.strictEqual(result.invoiceNumber, '123456');
  console.log('invoice-extract.selftest ok', {
    lines: result.lines.length,
    suggested: result.suggested,
  });
}

run();
