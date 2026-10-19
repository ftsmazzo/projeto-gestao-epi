/**
 * Cubagem, peso cubado e ficha fiscal do cadastro da distribuidora.
 * Uso: npx --yes tsx src/distributor/catalog.rules.selftest.ts
 */
import {
  CatalogRuleError,
  measureCubage,
  normalizeCatalog,
  normalizeCatalogPatch,
} from './catalog.rules';

function assert(name: string, ok: boolean) {
  if (!ok) throw new Error(`Falhou: ${name}`);
}

const boot = normalizeCatalog({
  unitCode: 'par',
  itemsPerBox: 10,
  lengthCm: 30,
  widthCm: 20,
  heightCm: 10,
  grossWeightKg: 1.2,
  boxLengthCm: 60,
  boxWidthCm: 40,
  boxHeightCm: 30,
  ncm: '6401.92.00',
  icmsSt: false,
});

assert('unidade PAR', boot.unitCode === 'PAR');
assert('medidas do item em mm', boot.lengthMm === 300 && boot.widthMm === 200 && boot.heightMm === 100);
assert('ncm sem pontuacao', boot.ncm === '64019200');
assert('cfop de revenda', boot.saleCfopIn === '5102' && boot.saleCfopOut === '6102');
assert('origem nacional', boot.originCode === 0 && boot.icmsSt === false);
assert('divisor 6000', boot.freightDivisor === 6000);

const item = measureCubage(boot.lengthMm, boot.widthMm, boot.heightMm, boot.freightDivisor);
assert(
  'cubagem 0,006 m3 e 1 kg cubado',
  item?.cubageM3 === 0.006 && item.volumetricWeightG === 1000,
);

const box = measureCubage(boot.boxLengthMm, boot.boxWidthMm, boot.boxHeightMm, boot.freightDivisor);
assert(
  'caixa 0,072 m3 e 12 kg cubados',
  box?.cubageM3 === 0.072 && box.volumetricWeightG === 12000,
);

let partial = false;
try {
  normalizeCatalog({ lengthCm: 10, widthCm: 10 });
} catch (error) {
  partial = error instanceof CatalogRuleError;
}
assert('medida incompleta recusa', partial);

let ncm = false;
try {
  normalizeCatalog({ ncm: '123' });
} catch (error) {
  ncm = error instanceof CatalogRuleError;
}
assert('ncm curto recusa', ncm);

let gtin = false;
try {
  normalizeCatalog({ gtin: '1234567' });
} catch (error) {
  gtin = error instanceof CatalogRuleError;
}
assert('gtin curto recusa', gtin);

const cleared = normalizeCatalogPatch({
  lengthCm: null,
  widthCm: null,
  heightCm: null,
  icmsSt: true,
  cest: '2805700',
});
assert(
  'limpar medidas e marcar ST',
  cleared.lengthMm === null &&
    cleared.widthMm === null &&
    cleared.heightMm === null &&
    cleared.icmsSt === true &&
    cleared.cest === '2805700',
);

console.log('catalog.rules.selftest ok');
