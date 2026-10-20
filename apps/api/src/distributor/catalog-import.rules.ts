import { CatalogRuleError, normalizeCatalog, type CatalogInput } from './catalog.rules';

export class CatalogImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CatalogImportError';
  }
}

export type CatalogImportRow = {
  line: number;
  name: string;
  internalSku: string;
  supplierSku: string | null;
  caNumber: string | null;
  sizes: string[];
  minQuantity: number | null;
  tracksLot: boolean;
  catalog: ReturnType<typeof normalizeCatalog>;
};

const HEADER_ALIASES: Record<string, string> = {
  nome: 'name',
  name: 'name',
  produto: 'name',
  codigo_interno: 'internalSku',
  codigointerno: 'internalSku',
  sku: 'internalSku',
  sku_interno: 'internalSku',
  internalsku: 'internalSku',
  codigo_fornecedor: 'supplierSku',
  codigofornecedor: 'supplierSku',
  sku_fornecedor: 'supplierSku',
  suppliersku: 'supplierSku',
  ca: 'caNumber',
  canumber: 'caNumber',
  tamanhos: 'sizes',
  tamanho: 'sizes',
  sizes: 'sizes',
  numeracao: 'sizes',
  gtin: 'gtin',
  ean: 'gtin',
  codigo_barras: 'gtin',
  codigo_de_barras: 'gtin',
  codigodebarras: 'gtin',
  unidade: 'unitCode',
  unit: 'unitCode',
  unitcode: 'unitCode',
  ncm: 'ncm',
  minimo: 'minQuantity',
  estoque_minimo: 'minQuantity',
  minquantity: 'minQuantity',
  custo: 'costReais',
  custo_reais: 'costReais',
  preco_custo: 'costReais',
  controla_lote: 'tracksLot',
  lote: 'tracksLot',
  trackslot: 'tracksLot',
};

export function normalizeImportHeader(header: string): string | null {
  const key = header
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return HEADER_ALIASES[key] ?? null;
}

export function splitSizeLabels(raw: string): string[] {
  const text = raw.trim();
  if (!text) return ['Único'];
  const parts = text
    .split(/[|;,/]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const unique: string[] = [];
  for (const part of parts) {
    const exists = unique.some(
      (item) => item.toLocaleLowerCase('pt-BR') === part.toLocaleLowerCase('pt-BR'),
    );
    if (!exists) unique.push(part);
  }
  return unique.length > 0 ? unique : ['Único'];
}

export function parseCostReaisToCents(raw: string): number | null {
  const text = raw.trim();
  if (!text) return null;
  const normalized = text.replace(/\./g, '').replace(',', '.');
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) {
    throw new CatalogImportError('Custo invalido.');
  }
  return Math.round(value * 100);
}

export function parseTracksLot(raw: string): boolean {
  const text = raw.trim().toLowerCase();
  if (!text) return false;
  return ['1', 'true', 'sim', 's', 'yes', 'y', 'x'].includes(text);
}

export function buildCatalogImportRows(
  headers: string[],
  records: string[][],
): { rows: CatalogImportRow[]; errors: string[] } {
  if (headers.length === 0) {
    throw new CatalogImportError('O CSV esta vazio.');
  }
  const mappedHeaders = headers.map((header) => ({
    raw: header,
    key: normalizeImportHeader(header),
  }));
  const hasName = mappedHeaders.some((item) => item.key === 'name');
  const hasSku = mappedHeaders.some((item) => item.key === 'internalSku');
  if (!hasName || !hasSku) {
    throw new CatalogImportError(
      'O CSV precisa das colunas nome e codigo_interno (ou sku).',
    );
  }

  const rows: CatalogImportRow[] = [];
  const errors: string[] = [];

  records.forEach((cells, index) => {
    const line = index + 2;
    const values: Record<string, string> = {};
    mappedHeaders.forEach((header, col) => {
      if (!header.key) return;
      values[header.key] = (cells[col] ?? '').trim();
    });
    if (!values.name && !values.internalSku) return;
    try {
      if (!values.name || values.name.length < 2) {
        throw new CatalogImportError('Informe o nome.');
      }
      if (!values.internalSku) {
        throw new CatalogImportError('Informe o codigo interno.');
      }
      const minRaw = values.minQuantity?.trim() ?? '';
      let minQuantity: number | null = null;
      if (minRaw) {
        const min = Number(minRaw);
        if (!Number.isInteger(min) || min < 0) {
          throw new CatalogImportError('Minimo invalido.');
        }
        minQuantity = min;
      }
      const catalogInput: CatalogInput = {
        unitCode: values.unitCode || 'UN',
        gtin: values.gtin || null,
        ncm: values.ncm || null,
        costCents: parseCostReaisToCents(values.costReais ?? ''),
      };
      const catalog = normalizeCatalog(catalogInput);
      rows.push({
        line,
        name: values.name,
        internalSku: values.internalSku,
        supplierSku: values.supplierSku || null,
        caNumber: values.caNumber || null,
        sizes: splitSizeLabels(values.sizes ?? ''),
        minQuantity,
        tracksLot: parseTracksLot(values.tracksLot ?? ''),
        catalog,
      });
    } catch (error) {
      const message =
        error instanceof CatalogImportError || error instanceof CatalogRuleError
          ? error.message
          : 'Linha invalida.';
      errors.push(`Linha ${line}: ${message}`);
    }
  });

  if (rows.length === 0 && errors.length === 0) {
    throw new CatalogImportError('Nenhum produto encontrado no CSV.');
  }
  return { rows, errors };
}

export function catalogImportTemplateCsv(): string {
  return [
    'nome;codigo_interno;tamanhos;codigo_fornecedor;ca;gtin;unidade;ncm;minimo;custo;controla_lote',
    'Luva nitrilica;LUVA-NIT;P|M|G;FORN-01;12345;7891234567890;PAR;40151900;10;12,90;sim',
    'Capacete;CAP-01;Unico;;;7891234567891;UN;65061000;5;45,00;nao',
  ].join('\n');
}
