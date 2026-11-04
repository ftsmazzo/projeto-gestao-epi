/**
 * Uso: npx --yes tsx src/distributor/catalog-quote-extract.selftest.ts
 */
import { extractCatalogQuoteFromFile } from './catalog-quote-extract';

function assert(ok: boolean, message: string) {
  if (!ok) throw new Error(message);
}

async function main() {
  const rejected = await extractCatalogQuoteFromFile({
    buffer: Buffer.from('not-a-file'),
    mimeType: 'text/plain',
    originalName: 'x.txt',
  });
  assert(rejected.ok === false, 'reject non pdf/image');
  assert(rejected.items.length === 0, 'no items');

  console.log('catalog-quote-extract.selftest ok');
}

void main();
