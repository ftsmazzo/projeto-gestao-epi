export class NfeXmlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NfeXmlError';
  }
}

export type ParsedNfeLineTax = {
  icmsCents: number;
  icmsStCents: number;
  ipiCents: number;
  pisCents: number;
  cofinsCents: number;
  freightCents: number;
  productCents: number | null;
};

export type ParsedNfeLine = {
  description: string;
  quantity: number;
  unitCostCents: number | null;
  ncm: string | null;
  cfop: string | null;
  productCode: string | null;
  gtin: string | null;
  tax: ParsedNfeLineTax;
};

export type ParsedNfeTotals = {
  productsCents: number;
  freightCents: number;
  insuranceCents: number;
  discountCents: number;
  icmsCents: number;
  icmsStCents: number;
  ipiCents: number;
  pisCents: number;
  cofinsCents: number;
  invoiceCents: number;
};

export type ParsedNfe = {
  accessKey: string;
  invoiceNumber: string;
  series: string;
  supplierName: string;
  supplierCnpj: string;
  recipientCnpj: string;
  totals: ParsedNfeTotals;
  lines: ParsedNfeLine[];
};

export function accessKeyCheckDigit(first43: string): number {
  let weight = 2;
  let sum = 0;
  for (let index = first43.length - 1; index >= 0; index -= 1) {
    sum += Number(first43[index]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const mod = sum % 11;
  return mod < 2 ? 0 : 11 - mod;
}

export function assertAccessKey(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 44) {
    throw new NfeXmlError('A chave de acesso precisa ter 44 digitos.');
  }
  const expected = accessKeyCheckDigit(digits.slice(0, 43));
  if (Number(digits[43]) !== expected) {
    throw new NfeXmlError('A chave de acesso nao confere.');
  }
  return digits;
}

export function parseNfeXml(xml: string): ParsedNfe {
  const source = xml.replace(/^\uFEFF/, '');
  if (!/<infNFe[\s>]/i.test(source)) {
    throw new NfeXmlError('O arquivo nao e um XML de NF-e.');
  }
  const idMatch = source.match(/Id="NFe(\d{44})"/i);
  const keyTag = tagText(source, 'chNFe');
  const accessKey = assertAccessKey(idMatch?.[1] ?? keyTag ?? '');
  const emit = block(source, 'emit');
  const dest = block(source, 'dest');
  const ide = block(source, 'ide');
  const supplierName = tagText(emit, 'xNome');
  const supplierCnpj = digits(tagText(emit, 'CNPJ'));
  const recipientCnpj = digits(tagText(dest, 'CNPJ'));
  const invoiceNumber = digits(tagText(ide, 'nNF'));
  const series = digits(tagText(ide, 'serie'));
  if (!supplierName || supplierCnpj.length !== 14 || recipientCnpj.length !== 14) {
    throw new NfeXmlError('O XML precisa ter emitente, destinatario e CNPJ.');
  }
  if (!invoiceNumber) {
    throw new NfeXmlError('O XML nao trouxe o numero da nota.');
  }
  const lines = source
    .split(/<det[\s>]/i)
    .slice(1)
    .map(parseLine)
    .filter((line): line is ParsedNfeLine => line != null);
  if (lines.length === 0) {
    throw new NfeXmlError('O XML nao trouxe itens da nota.');
  }
  const totalsBlock = block(source, 'ICMSTot') || block(source, 'total');
  const totals = parseTotals(totalsBlock, lines);
  return {
    accessKey,
    invoiceNumber,
    series,
    supplierName,
    supplierCnpj,
    recipientCnpj,
    totals,
    lines,
  };
}

function parseLine(chunk: string): ParsedNfeLine | null {
  const description = tagText(chunk, 'xProd');
  if (!description) return null;
  const quantity = integerQuantity(tagText(chunk, 'qCom'), description);
  const unit = tagText(chunk, 'vUnCom');
  const unitCostCents =
    unit == null ? null : Math.round(Number(unit.replace(',', '.')) * 100);
  const gtinRaw = tagText(chunk, 'cEAN') || tagText(chunk, 'cEANTrib');
  const gtin = digits(gtinRaw);
  return {
    description: description.slice(0, 500),
    quantity,
    unitCostCents:
      unitCostCents != null && Number.isFinite(unitCostCents) ? unitCostCents : null,
    ncm: digits(tagText(chunk, 'NCM')) || null,
    cfop: digits(tagText(chunk, 'CFOP')) || null,
    productCode: tagText(chunk, 'cProd'),
    gtin: gtin && gtin !== 'SEM GTIN' && gtin.length >= 8 ? gtin : null,
    tax: {
      productCents: moneyToCents(tagText(chunk, 'vProd')),
      freightCents: moneyToCents(tagText(chunk, 'vFrete')) ?? 0,
      icmsCents: firstMoney(chunk, ['vICMS']) ?? 0,
      icmsStCents: firstMoney(chunk, ['vICMSST', 'vST']) ?? 0,
      ipiCents: firstMoney(chunk, ['vIPI']) ?? 0,
      pisCents: firstMoney(chunk, ['vPIS']) ?? 0,
      cofinsCents: firstMoney(chunk, ['vCOFINS']) ?? 0,
    },
  };
}

function parseTotals(blockXml: string, lines: ParsedNfeLine[]): ParsedNfeTotals {
  const fromLines = lines.reduce(
    (acc, line) => ({
      productsCents: acc.productsCents + (line.tax.productCents ?? 0),
      freightCents: acc.freightCents + line.tax.freightCents,
      icmsCents: acc.icmsCents + line.tax.icmsCents,
      icmsStCents: acc.icmsStCents + line.tax.icmsStCents,
      ipiCents: acc.ipiCents + line.tax.ipiCents,
      pisCents: acc.pisCents + line.tax.pisCents,
      cofinsCents: acc.cofinsCents + line.tax.cofinsCents,
    }),
    {
      productsCents: 0,
      freightCents: 0,
      icmsCents: 0,
      icmsStCents: 0,
      ipiCents: 0,
      pisCents: 0,
      cofinsCents: 0,
    },
  );
  return {
    productsCents: moneyToCents(tagText(blockXml, 'vProd')) ?? fromLines.productsCents,
    freightCents: moneyToCents(tagText(blockXml, 'vFrete')) ?? fromLines.freightCents,
    insuranceCents: moneyToCents(tagText(blockXml, 'vSeg')) ?? 0,
    discountCents: moneyToCents(tagText(blockXml, 'vDesc')) ?? 0,
    icmsCents: moneyToCents(tagText(blockXml, 'vICMS')) ?? fromLines.icmsCents,
    icmsStCents:
      moneyToCents(tagText(blockXml, 'vST')) ??
      moneyToCents(tagText(blockXml, 'vICMSST')) ??
      fromLines.icmsStCents,
    ipiCents: moneyToCents(tagText(blockXml, 'vIPI')) ?? fromLines.ipiCents,
    pisCents: moneyToCents(tagText(blockXml, 'vPIS')) ?? fromLines.pisCents,
    cofinsCents: moneyToCents(tagText(blockXml, 'vCOFINS')) ?? fromLines.cofinsCents,
    invoiceCents:
      moneyToCents(tagText(blockXml, 'vNF')) ??
      fromLines.productsCents +
        fromLines.freightCents +
        fromLines.icmsStCents +
        fromLines.ipiCents,
  };
}

function integerQuantity(raw: string | null, description: string): number {
  if (!raw) {
    throw new NfeXmlError(`O item ${description} nao tem quantidade.`);
  }
  const value = Number(raw.replace(',', '.'));
  if (!Number.isFinite(value) || value <= 0) {
    throw new NfeXmlError(`A quantidade de ${description} e invalida.`);
  }
  const quantity = Math.round(value);
  if (Math.abs(value - quantity) > 0.001) {
    throw new NfeXmlError(`A quantidade de ${description} precisa ser inteira.`);
  }
  return quantity;
}

function moneyToCents(raw: string | null): number | null {
  if (!raw?.trim()) return null;
  const value = Number(raw.replace(',', '.'));
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

function firstMoney(xml: string, tags: string[]): number | null {
  for (const tag of tags) {
    const cents = moneyToCents(tagText(xml, tag));
    if (cents != null) return cents;
  }
  return null;
}

function block(xml: string, name: string): string {
  const match = xml.match(new RegExp(`<(?:\\w+:)?${name}\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?${name}>`, 'i'));
  return match?.[1] ?? '';
}

function tagText(xml: string, name: string): string | null {
  const match = xml.match(new RegExp(`<(?:\\w+:)?${name}\\b[^>]*>([^<]*)</(?:\\w+:)?${name}>`, 'i'));
  const text = match?.[1]?.trim();
  return text ? decodeXml(text) : null;
}

function digits(value: string | null): string {
  return (value ?? '').replace(/\D/g, '');
}

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
