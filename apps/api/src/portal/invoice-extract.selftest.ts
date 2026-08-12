import assert from 'assert';
import {
  parseInvoiceText,
  parseMoneyToCents,
  pickInvoiceLine,
} from './invoice-extract';

function run() {
  assert.strictEqual(parseMoneyToCents('12,50'), 1250);
  assert.strictEqual(parseMoneyToCents('1.234,56'), 123456);
  assert.strictEqual(parseMoneyToCents('9,7000'), 970);

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

  const danfe = `
RECEBEMOS DE NORTEL SUPRIMENTOS INDUSTRIAIS LTDA OS PRODUTOS E/OU SERVIÇOS CONSTANTES DA NOTA FISCAL ELETRÔNICA INDICADA AO LADO.
NF-e
Nº. 000.599.669
IDENTIFICAÇÃO DO EMITENTE
NORTEL SUPRIMENTOS INDUSTRIAIS LTDA
V. TOTAL DA NOTA
3.890,00
DADOS DOS PRODUTOS / SERVIÇOS
CÓDIGO PRODUTO DESCRIÇÃO DO PRODUTO / SERVIÇO NCM/SH O/CST CFOP UN QUANT VALOR UNIT VALOR TOTAL
1503343 RESPIRADOR DESC BR C/VALV PFF2-S 8822 HB004835516
ITEM 0 - CA: 5657 63079010 5/00 6102 PC 200,0000 9,7000 1.940,00 0,00 1.940,00 232,80 12,00
116868 FILTRO MEC CL P2 PART 5N11 H0002260174 ITEM 0 - 59119000 5/00 6102 PR 100,0000 19,5000 1.950,00 0,00 1.950,00 234,00 12,00
DADOS ADICIONAIS
Inf. fisco: TOTAL BASE CALC CBS: 3.106,55 TOTAL CBS: 27,96 TOTAL BASE CALC COFINS: 3.423,20
`;

  const nf = parseInvoiceText(danfe);
  assert.ok(nf.ok, nf.message);
  assert.strictEqual(nf.invoiceNumber, '599669');
  assert.match(nf.supplierName ?? '', /NORTEL/i);
  assert.strictEqual(nf.lines.length, 2, JSON.stringify(nf.lines, null, 2));

  const mask = nf.lines.find((line) => /respirador/i.test(line.description));
  assert.ok(mask, `sem respirador: ${nf.lines.map((l) => l.description).join(' | ')}`);
  assert.strictEqual(mask.caNumber, '5657');
  assert.strictEqual(mask.quantity, 200);
  assert.strictEqual(mask.unitCostCents, 970);
  assert.strictEqual(mask.totalCostCents, 194000);

  const filter = nf.lines.find((line) => /filtro/i.test(line.description));
  assert.ok(filter);
  assert.strictEqual(filter.quantity, 100);
  assert.strictEqual(filter.unitCostCents, 1950);
  assert.strictEqual(filter.totalCostCents, 195000);
  assert.notStrictEqual(filter.caNumber, '5657');

  assert.ok(
    !nf.lines.some((line) => line.unitCostCents === 2796),
    'pegou TOTAL CBS 27,96 como unitario',
  );

  const picked = pickInvoiceLine(nf.lines, {
    caNumber: '5657',
    description: 'RESPIRADOR PURIFICADOR DE AR TIPO PEÇA SEMIFACIAL PFF2',
  });
  assert.strictEqual(picked?.caNumber, '5657');
  assert.strictEqual(picked?.quantity, 200);
  assert.strictEqual(picked?.unitCostCents, 970);

  console.log('invoice-extract.selftest ok', {
    simple: result.suggested,
    danfe: nf.lines.map((line) => ({
      d: line.description,
      q: line.quantity,
      u: line.unitCostCents,
      t: line.totalCostCents,
      ca: line.caNumber,
    })),
  });
}

run();
