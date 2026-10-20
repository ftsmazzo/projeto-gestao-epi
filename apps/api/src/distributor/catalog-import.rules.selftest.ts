/**
 * Uso: npx --yes tsx src/distributor/catalog-import.rules.selftest.ts
 */
import {
  CatalogImportError,
  buildCatalogImportRows,
  catalogImportTemplateCsv,
  normalizeImportHeader,
  splitSizeLabels,
} from './catalog-import.rules';
import { parseCsvText } from '../epis/epi-import.utils';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

assert(normalizeImportHeader('Código interno') === 'internalSku', 'header sku');
assert(normalizeImportHeader('codigo de barras') === 'gtin', 'header gtin');
assert(splitSizeLabels('P|M|G').join(',') === 'P,M,G', 'sizes');
assert(splitSizeLabels('')[0] === 'Único', 'size default');

const parsed = parseCsvText(catalogImportTemplateCsv());
const built = buildCatalogImportRows(parsed.headers, parsed.records);
assert(built.rows.length === 2, 'two products');
assert(built.rows[0]!.sizes.length === 3, 'three sizes');
assert(built.errors.length === 0, 'no errors');

let bad = false;
try {
  buildCatalogImportRows(['foo'], [['x']]);
} catch (error) {
  bad = error instanceof CatalogImportError;
}
assert(bad, 'missing columns');

console.log('catalog-import.rules.selftest ok');
