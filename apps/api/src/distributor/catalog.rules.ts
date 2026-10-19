export class CatalogRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CatalogRuleError';
  }
}

export const UNITS = ['UN', 'PAR', 'CX'] as const;
export const DEFAULT_FREIGHT_DIVISOR = 6000;
export const DEFAULT_SALE_CFOP_IN = '5102';
export const DEFAULT_SALE_CFOP_OUT = '6102';
export const DEFAULT_BUY_CFOP_IN = '1102';
export const DEFAULT_BUY_CFOP_OUT = '2102';

export type CatalogInput = {
  unitCode?: string | null;
  itemsPerBox?: number | null;
  gtin?: string | null;
  warehouseLocation?: string | null;
  costCents?: number | null;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  netWeightKg?: number | null;
  grossWeightKg?: number | null;
  boxLengthCm?: number | null;
  boxWidthCm?: number | null;
  boxHeightCm?: number | null;
  freightDivisor?: number | null;
  originCode?: number | null;
  cest?: string | null;
  ncm?: string | null;
  saleCfopIn?: string | null;
  saleCfopOut?: string | null;
  buyCfopIn?: string | null;
  buyCfopOut?: string | null;
  icmsSt?: boolean | null;
};

export type StoredCatalog = {
  unitCode: string;
  itemsPerBox: number | null;
  gtin: string | null;
  warehouseLocation: string | null;
  costCents: number | null;
  lengthMm: number | null;
  widthMm: number | null;
  heightMm: number | null;
  netWeightG: number | null;
  grossWeightG: number | null;
  boxLengthMm: number | null;
  boxWidthMm: number | null;
  boxHeightMm: number | null;
  freightDivisor: number;
  originCode: number;
  cest: string | null;
  ncm: string | null;
  saleCfopIn: string;
  saleCfopOut: string;
  buyCfopIn: string;
  buyCfopOut: string;
  icmsSt: boolean;
};

export function normalizeCatalog(input: CatalogInput): StoredCatalog {
  const dimensions = readTrio(
    input.lengthCm,
    input.widthCm,
    input.heightCm,
    'do item',
  );
  const box = readTrio(
    input.boxLengthCm,
    input.boxWidthCm,
    input.boxHeightCm,
    'da caixa',
  );
  return {
    unitCode: readUnit(input.unitCode),
    itemsPerBox: readItemsPerBox(input.itemsPerBox),
    gtin: readGtin(input.gtin),
    warehouseLocation: readLocation(input.warehouseLocation),
    costCents: readCost(input.costCents),
    lengthMm: dimensions[0],
    widthMm: dimensions[1],
    heightMm: dimensions[2],
    netWeightG: readWeight(input.netWeightKg, 'liquido'),
    grossWeightG: readWeight(input.grossWeightKg, 'bruto'),
    boxLengthMm: box[0],
    boxWidthMm: box[1],
    boxHeightMm: box[2],
    freightDivisor: readDivisor(input.freightDivisor),
    originCode: readOrigin(input.originCode),
    cest: readCest(input.cest),
    ncm: readNcm(input.ncm),
    saleCfopIn: readCfop(input.saleCfopIn, DEFAULT_SALE_CFOP_IN),
    saleCfopOut: readCfop(input.saleCfopOut, DEFAULT_SALE_CFOP_OUT),
    buyCfopIn: readCfop(input.buyCfopIn, DEFAULT_BUY_CFOP_IN),
    buyCfopOut: readCfop(input.buyCfopOut, DEFAULT_BUY_CFOP_OUT),
    icmsSt: input.icmsSt === true,
  };
}

export function normalizeCatalogPatch(
  input: Partial<CatalogInput>,
): Partial<StoredCatalog> {
  const patch: Partial<StoredCatalog> = {};
  if ('unitCode' in input) patch.unitCode = readUnit(input.unitCode);
  if ('itemsPerBox' in input) patch.itemsPerBox = readItemsPerBox(input.itemsPerBox);
  if ('gtin' in input) patch.gtin = readGtin(input.gtin);
  if ('warehouseLocation' in input) {
    patch.warehouseLocation = readLocation(input.warehouseLocation);
  }
  if ('costCents' in input) patch.costCents = readCost(input.costCents);
  if ('lengthCm' in input || 'widthCm' in input || 'heightCm' in input) {
    const [lengthMm, widthMm, heightMm] = readTrio(
      input.lengthCm,
      input.widthCm,
      input.heightCm,
      'do item',
    );
    patch.lengthMm = lengthMm;
    patch.widthMm = widthMm;
    patch.heightMm = heightMm;
  }
  if ('netWeightKg' in input) patch.netWeightG = readWeight(input.netWeightKg, 'liquido');
  if ('grossWeightKg' in input) {
    patch.grossWeightG = readWeight(input.grossWeightKg, 'bruto');
  }
  if (
    'boxLengthCm' in input ||
    'boxWidthCm' in input ||
    'boxHeightCm' in input
  ) {
    const [boxLengthMm, boxWidthMm, boxHeightMm] = readTrio(
      input.boxLengthCm,
      input.boxWidthCm,
      input.boxHeightCm,
      'da caixa',
    );
    patch.boxLengthMm = boxLengthMm;
    patch.boxWidthMm = boxWidthMm;
    patch.boxHeightMm = boxHeightMm;
  }
  if ('freightDivisor' in input) patch.freightDivisor = readDivisor(input.freightDivisor);
  if ('originCode' in input) patch.originCode = readOrigin(input.originCode);
  if ('cest' in input) patch.cest = readCest(input.cest);
  if ('ncm' in input) patch.ncm = readNcm(input.ncm);
  if ('saleCfopIn' in input) patch.saleCfopIn = readCfop(input.saleCfopIn, null);
  if ('saleCfopOut' in input) patch.saleCfopOut = readCfop(input.saleCfopOut, null);
  if ('buyCfopIn' in input) patch.buyCfopIn = readCfop(input.buyCfopIn, null);
  if ('buyCfopOut' in input) patch.buyCfopOut = readCfop(input.buyCfopOut, null);
  if ('icmsSt' in input) patch.icmsSt = input.icmsSt === true;
  return patch;
}

export function measureCubage(
  lengthMm: number | null,
  widthMm: number | null,
  heightMm: number | null,
  freightDivisor: number,
): { cubageM3: number; volumetricWeightG: number } | null {
  if (lengthMm == null || widthMm == null || heightMm == null) return null;
  const cubicMm = lengthMm * widthMm * heightMm;
  return {
    cubageM3: cubicMm / 1_000_000_000,
    volumetricWeightG: Math.round(cubicMm / freightDivisor),
  };
}

function readUnit(value: string | null | undefined): string {
  const unit = (value ?? 'UN').trim().toUpperCase();
  if (!UNITS.includes(unit as (typeof UNITS)[number])) {
    throw new CatalogRuleError('A unidade precisa ser UN, PAR ou CX.');
  }
  return unit;
}

function readItemsPerBox(value: number | null | undefined): number | null {
  if (value == null) return null;
  if (!Number.isInteger(value) || value < 1 || value > 100000) {
    throw new CatalogRuleError('Itens por caixa precisa ser um inteiro de 1 a 100000.');
  }
  return value;
}

function readGtin(value: string | null | undefined): string | null {
  const digits = digitsOnly(value);
  if (!digits) return null;
  if (![8, 12, 13, 14].includes(digits.length)) {
    throw new CatalogRuleError('GTIN precisa ter 8, 12, 13 ou 14 digitos.');
  }
  return digits;
}

function readLocation(value: string | null | undefined): string | null {
  const text = value?.trim() ?? '';
  if (!text) return null;
  if (text.length > 80) {
    throw new CatalogRuleError('O endereco no deposito tem no maximo 80 caracteres.');
  }
  return text;
}

function readCost(value: number | null | undefined): number | null {
  if (value == null) return null;
  if (!Number.isInteger(value) || value < 0 || value > 100_000_000) {
    throw new CatalogRuleError('O custo precisa ser um valor em centavos.');
  }
  return value;
}

function readTrio(
  lengthCm: number | null | undefined,
  widthCm: number | null | undefined,
  heightCm: number | null | undefined,
  label: string,
): [number | null, number | null, number | null] {
  const values = [lengthCm, widthCm, heightCm];
  const filled = values.filter((item) => item != null);
  if (filled.length === 0) return [null, null, null];
  if (filled.length !== 3) {
    throw new CatalogRuleError(
      `Informe comprimento, largura e altura ${label} juntos.`,
    );
  }
  return [
    cmToMm(lengthCm, label),
    cmToMm(widthCm, label),
    cmToMm(heightCm, label),
  ];
}

function cmToMm(value: number | null | undefined, label: string): number {
  if (value == null || !Number.isFinite(value) || value <= 0 || value > 1000) {
    throw new CatalogRuleError(
      `Cada medida ${label} fica entre 0 e 1000 cm.`,
    );
  }
  const mm = Math.round(value * 10);
  if (mm < 1) {
    throw new CatalogRuleError(`Cada medida ${label} fica entre 0 e 1000 cm.`);
  }
  return mm;
}

function readWeight(
  value: number | null | undefined,
  label: string,
): number | null {
  if (value == null) return null;
  if (!Number.isFinite(value) || value <= 0 || value > 10000) {
    throw new CatalogRuleError(`O peso ${label} fica entre 0 e 10000 kg.`);
  }
  const grams = Math.round(value * 1000);
  if (grams < 1) {
    throw new CatalogRuleError(`O peso ${label} fica entre 0 e 10000 kg.`);
  }
  return grams;
}

function readDivisor(value: number | null | undefined): number {
  if (value == null) return DEFAULT_FREIGHT_DIVISOR;
  if (!Number.isInteger(value) || value < 1000 || value > 20000) {
    throw new CatalogRuleError('O divisor do frete fica entre 1000 e 20000.');
  }
  return value;
}

function readOrigin(value: number | null | undefined): number {
  if (value == null) return 0;
  if (!Number.isInteger(value) || value < 0 || value > 8) {
    throw new CatalogRuleError('A origem da mercadoria fica entre 0 e 8.');
  }
  return value;
}

function readNcm(value: string | null | undefined): string | null {
  const digits = digitsOnly(value);
  if (!digits) return null;
  if (digits.length !== 8) {
    throw new CatalogRuleError('NCM precisa ter 8 digitos.');
  }
  return digits;
}

function readCest(value: string | null | undefined): string | null {
  const digits = digitsOnly(value);
  if (!digits) return null;
  if (digits.length !== 7) {
    throw new CatalogRuleError('CEST precisa ter 7 digitos.');
  }
  return digits;
}

function readCfop(
  value: string | null | undefined,
  fallback: string | null,
): string {
  const digits = digitsOnly(value);
  if (!digits) {
    if (fallback) return fallback;
    throw new CatalogRuleError('CFOP precisa ter 4 digitos.');
  }
  if (digits.length !== 4) {
    throw new CatalogRuleError('CFOP precisa ter 4 digitos.');
  }
  return digits;
}

function digitsOnly(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '');
}
