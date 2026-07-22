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
  const normalized = content.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    throw new Error('Arquivo vazio.');
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = parseDelimitedLine(lines[0], delimiter);
  const rows = lines.slice(1).map((line) => parseDelimitedLine(line, delimiter));
  return { headers, rows };
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
