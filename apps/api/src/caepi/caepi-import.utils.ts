import ExcelJS from 'exceljs';

/** Normaliza cabecalho CAEPI para chave estavel (sem acento/espaco). */
export function normalizeHeaderKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
}

export function normalizeCaNumber(value: string): string {
  return value.trim().replace(/\s+/g, '');
}

export function normalizeOptionalText(value?: string | null): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Campos usados no unique de norma: vazio vira '' para unicidade no Postgres. */
export function normalizeUniqueKey(value?: string | null): string {
  return normalizeOptionalText(value) ?? '';
}

export function formatDateBrUtc(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = String(date.getUTCFullYear());
  return `${day}/${month}/${year}`;
}

/** Converte serial Excel (dias desde 1899-12-30) para Date UTC. */
export function excelSerialToDate(serial: number): Date | null {
  if (!Number.isFinite(serial)) {
    return null;
  }
  const utc = Date.UTC(1899, 11, 30) + Math.round(serial * 86400000);
  const date = new Date(utc);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseCaepiDate(value?: string | null): Date | null {
  const raw = normalizeOptionalText(value);
  if (!raw) {
    return null;
  }

  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);
  if (br) {
    const day = Number(br[1]);
    const month = Number(br[2]);
    const year = Number(br[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return null;
    }
    return date;
  }

  const iso = new Date(raw);
  return Number.isNaN(iso.getTime()) ? null : iso;
}

export function parseCaepiDateValue(value: unknown): Date | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'number') {
    if (value > 20000 && value < 80000) {
      return excelSerialToDate(value);
    }
    return null;
  }
  return parseCaepiDate(String(value));
}

export function detectDelimiter(headerLine: string): string {
  const candidates = [';', '\t', ',', '|'] as const;
  let best: (typeof candidates)[number] = ';';
  let bestCount = -1;
  for (const candidate of candidates) {
    const count = headerLine.split(candidate).length - 1;
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

export function parseDelimitedLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

export function parseCsvContent(content: string): {
  headers: string[];
  rows: string[][];
} {
  const normalized = content
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
  const lines = normalized
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    throw new Error('Arquivo vazio.');
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = parseDelimitedLine(lines[0], delimiter);
  const rows = lines
    .slice(1)
    .map((line) => parseDelimitedLine(line, delimiter));
  return { headers, rows };
}

export function excelCellToPlainText(
  value: ExcelJS.CellValue,
  formattedText?: string,
): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  if (value instanceof Date) {
    return formatDateBrUtc(value);
  }

  if (typeof value === 'number') {
    const formatted = normalizeOptionalText(formattedText);
    if (formatted) {
      return formatted;
    }
    if (Number.isInteger(value)) {
      return String(Math.trunc(value));
    }
    return String(value);
  }

  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'object') {
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text ?? '').join('');
    }
    if ('text' in value && typeof value.text === 'string') {
      return value.text;
    }
    if ('result' in value) {
      return excelCellToPlainText(
        value.result as ExcelJS.CellValue,
        formattedText,
      );
    }
    if ('formula' in value || 'sharedFormula' in value) {
      return normalizeOptionalText(formattedText) ?? '';
    }
  }

  return normalizeOptionalText(formattedText) ?? '';
}

export function isBlankRow(cells: string[]): boolean {
  return cells.every((cell) => !cell || !cell.trim());
}

export type CaepiParsedTable = {
  headers: string[];
  rows: string[][];
  sheetName?: string;
};

export async function parseXlsxContent(
  buffer: Buffer,
): Promise<CaepiParsedTable> {
  const workbook = new ExcelJS.Workbook();
  // exceljs tipa `load` como Buffer legado; cast evita conflito com Buffer Node moderno.
  await workbook.xlsx.load(buffer as never);

  const preferred =
    workbook.getWorksheet('tgg_export_caepi') ?? workbook.worksheets[0];
  if (!preferred) {
    throw new Error('Planilha XLSX sem abas legiveis.');
  }

  const rows: string[][] = [];
  let headers: string[] | null = null;
  let headerColumnCount = 0;

  preferred.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const values: string[] = [];
    const maxCol = Math.max(row.cellCount, headerColumnCount);
    for (let col = 1; col <= maxCol; col += 1) {
      const cell = row.getCell(col);
      values.push(excelCellToPlainText(cell.value, cell.text));
    }

    if (!headers) {
      headers = values.map((value) => value.trim());
      headerColumnCount = headers.length;
      if (headers.every((h) => !h)) {
        throw new Error(`Cabecalho vazio na aba "${preferred.name}".`);
      }
      return;
    }

    while (values.length < headerColumnCount) {
      values.push('');
    }

    if (isBlankRow(values)) {
      return;
    }

    rows.push(values.slice(0, headerColumnCount));
    void rowNumber;
  });

  if (!headers) {
    throw new Error(`Aba "${preferred.name}" sem cabecalho.`);
  }

  return {
    headers,
    rows,
    sheetName: preferred.name,
  };
}

export function detectImportFormat(
  originalName?: string,
): 'csv' | 'xlsx' | 'unknown' {
  const name = (originalName || '').toLowerCase();
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    return 'xlsx';
  }
  if (
    name.endsWith('.csv') ||
    name.endsWith('.txt') ||
    name.endsWith('.tsv')
  ) {
    return 'csv';
  }
  return 'unknown';
}

export async function parseCaepiFile(
  buffer: Buffer,
  originalName?: string,
): Promise<CaepiParsedTable> {
  const format = detectImportFormat(originalName);
  if (format === 'xlsx') {
    return parseXlsxContent(buffer);
  }
  if (format === 'csv') {
    return parseCsvContent(buffer.toString('utf8'));
  }

  // Sem extensao: tenta XLSX (zip) e cai para CSV.
  if (buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b) {
    return parseXlsxContent(buffer);
  }
  return parseCsvContent(buffer.toString('utf8'));
}

/** Mapa de cabecalhos oficiais CAEPI -> campos internos. */
export const CAEPI_HEADER_ALIASES: Record<string, string[]> = {
  caNumber: ['NR_REGISTRO_CA', 'NR_REGISTRO', 'CA', 'NUMERO_CA'],
  expiresAt: ['DATA_DE_VALIDADE', 'DATA_VALIDADE', 'VALIDADE'],
  status: ['SITUACAO', 'SITUACAO_CA', 'STATUS'],
  processNumber: ['NR_DO_PROCESSO', 'NR_PROCESSO', 'NUMERO_PROCESSO'],
  manufacturerCnpj: ['CNPJ'],
  manufacturerName: ['RAZAO_SOCIAL'],
  nature: ['NATUREZA'],
  equipmentName: ['EQUIPAMENTO'],
  equipmentDescription: [
    'DESCRICAO_EQUIPAMENTO',
    'DESCRICAO_DO_EQUIPAMENTO',
  ],
  brand: ['MARCA_CA', 'MARCA'],
  reference: ['REFERENCIA'],
  color: ['COR'],
  approvedFor: ['APROVADO_PARA_LAUDO', 'APROVADO_PARA'],
  restriction: ['RESTRICAO_LAUDO', 'RESTRICAO'],
  analysisNotes: [
    'OBSERVACAO_ANALISE_LAUDO',
    'OBSERVACAO_ANALISE',
    'OBSERVACOES',
  ],
  laboratoryCnpj: ['CNPJ_LABORATORIO'],
  laboratoryName: ['RAZAO_SOCIAL_LABORATORIO'],
  reportNumber: ['NR_LAUDO', 'NUMERO_LAUDO'],
  standard: ['NORMA'],
};

export const CAEPI_IMPORT_MAX_ERRORS = 100;
