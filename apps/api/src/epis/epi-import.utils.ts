import {
  EpiCategory,
  EpiUnitOfMeasure,
  EpiUsefulLifeUnit,
} from '@prisma/client';

/** Colunas canonicas aceitas na importacao CSV de EPIs. */
export type EpiCsvCanonicalField =
  | 'name'
  | 'description'
  | 'caNumber'
  | 'requiresCa'
  | 'caExpiresAt'
  | 'unitOfMeasure'
  | 'usefulLifeValue'
  | 'usefulLifeUnit'
  | 'category'
  | 'externalCode'
  | 'manufacturerName'
  | 'reference'
  | 'color'
  | 'approvedFor'
  | 'restriction'
  | 'technicalNotes'
  | 'nrr'
  | 'nrrsf'
  | 'size'
  | 'model'
  | 'side'
  | 'variantNotes';

const COLUMN_ALIASES: Record<string, EpiCsvCanonicalField> = {
  nome: 'name',
  name: 'name',
  descricao: 'description',
  description: 'description',
  ca: 'caNumber',
  canumber: 'caNumber',
  numero_ca: 'caNumber',
  numero_do_ca: 'caNumber',
  exige_ca: 'requiresCa',
  requiresca: 'requiresCa',
  validade_ca: 'caExpiresAt',
  caexpiresat: 'caExpiresAt',
  unidade: 'unitOfMeasure',
  unitofmeasure: 'unitOfMeasure',
  vida_util: 'usefulLifeValue',
  usefullifevalue: 'usefulLifeValue',
  unidade_vida_util: 'usefulLifeUnit',
  usefullifeunit: 'usefulLifeUnit',
  categoria: 'category',
  category: 'category',
  codigo_externo: 'externalCode',
  externalcode: 'externalCode',
  fabricante: 'manufacturerName',
  manufacturername: 'manufacturerName',
  referencia: 'reference',
  reference: 'reference',
  cor: 'color',
  color: 'color',
  aprovado_para: 'approvedFor',
  approvedfor: 'approvedFor',
  restricao: 'restriction',
  restriction: 'restriction',
  observacoes_tecnicas: 'technicalNotes',
  technicalnotes: 'technicalNotes',
  nrr: 'nrr',
  nrrsf: 'nrrsf',
  tamanho: 'size',
  size: 'size',
  modelo: 'model',
  model: 'model',
  lado: 'side',
  side: 'side',
  observacao_variacao: 'variantNotes',
  variantnotes: 'variantNotes',
};

export function normalizeCsvHeaderKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function resolveCsvColumn(
  header: string,
): EpiCsvCanonicalField | null {
  const key = normalizeCsvHeaderKey(header);
  return COLUMN_ALIASES[key] ?? null;
}

export function detectCsvDelimiter(headerLine: string): ',' | ';' {
  const commas = (headerLine.match(/,/g) ?? []).length;
  const semis = (headerLine.match(/;/g) ?? []).length;
  return semis > commas ? ';' : ',';
}

/** Parser CSV simples com aspas e delimitador , ou ;. */
export function parseCsvText(text: string): {
  headers: string[];
  records: string[][];
} {
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n').filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    return { headers: [], records: [] };
  }

  const delimiter = detectCsvDelimiter(lines[0]);
  const rows = lines.map((line) => parseCsvLine(line, delimiter));
  const headers = rows[0].map((h) => h.trim());
  const records = rows.slice(1);
  return { headers, records };
}

function parseCsvLine(line: string, delimiter: ',' | ';'): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === delimiter && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  cells.push(current);
  return cells;
}

export function mapCsvRecord(
  headers: string[],
  cells: string[],
): {
  mapped: Partial<Record<EpiCsvCanonicalField, string>>;
  unknownColumns: string[];
  raw: Record<string, string>;
} {
  const mapped: Partial<Record<EpiCsvCanonicalField, string>> = {};
  const unknownColumns: string[] = [];
  const raw: Record<string, string> = {};

  headers.forEach((header, index) => {
    const value = (cells[index] ?? '').trim();
    raw[header] = value;
    if (!header.trim()) {
      return;
    }
    const field = resolveCsvColumn(header);
    if (!field) {
      unknownColumns.push(header);
      return;
    }
    if (value) {
      mapped[field] = value;
    }
  });

  return { mapped, unknownColumns, raw };
}

export function normalizeCaNumber(value?: string | null): string | null {
  if (!value) return null;
  const normalized = value.trim().replace(/\s+/g, '');
  return normalized.length > 0 ? normalized : null;
}

export function normalizeOptionalText(value?: string | null): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function parseOptionalBoolean(
  value?: string | null,
): { ok: true; value: boolean | undefined } | { ok: false; message: string } {
  if (value === undefined || value === null || value.trim() === '') {
    return { ok: true, value: undefined };
  }
  const key = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
  if (['1', 'true', 'sim', 's', 'yes', 'y'].includes(key)) {
    return { ok: true, value: true };
  }
  if (['0', 'false', 'nao', 'n', 'no'].includes(key)) {
    return { ok: true, value: false };
  }
  return {
    ok: false,
    message: `Valor invalido para exige_ca/requiresCa: "${value}". Use sim/nao ou true/false.`,
  };
}

export function parseOptionalDate(
  value?: string | null,
): { ok: true; value: string | null } | { ok: false; message: string } {
  if (!value || !value.trim()) {
    return { ok: true, value: null };
  }
  const raw = value.trim();

  const br = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
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
      return { ok: false, message: `Data de validade invalida: "${value}".` };
    }
    return { ok: true, value: date.toISOString().slice(0, 10) };
  }

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) {
      return { ok: false, message: `Data de validade invalida: "${value}".` };
    }
    return { ok: true, value: date.toISOString().slice(0, 10) };
  }

  return {
    ok: false,
    message: `Data de validade invalida: "${value}". Use DD/MM/AAAA ou AAAA-MM-DD.`,
  };
}

export function parseOptionalNonNegativeInt(
  value: string | undefined,
  label: string,
): { ok: true; value: number | null } | { ok: false; message: string } {
  if (!value || !value.trim()) {
    return { ok: true, value: null };
  }
  const n = Number(value.replace(',', '.').trim());
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
    return {
      ok: false,
      message: `${label} deve ser um inteiro maior ou igual a zero.`,
    };
  }
  return { ok: true, value: n };
}

export function parseOptionalFloat(
  value: string | undefined,
  label: string,
): { ok: true; value: number | null } | { ok: false; message: string } {
  if (!value || !value.trim()) {
    return { ok: true, value: null };
  }
  const n = Number(value.replace(',', '.').trim());
  if (!Number.isFinite(n)) {
    return { ok: false, message: `${label} invalido.` };
  }
  return { ok: true, value: n };
}

export function mapUnitOfMeasure(
  value?: string | null,
): { ok: true; value: EpiUnitOfMeasure | undefined } | { ok: false; message: string } {
  if (!value || !value.trim()) {
    return { ok: true, value: undefined };
  }
  const key = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');
  const aliases: Record<string, EpiUnitOfMeasure> = {
    UNIDADE: EpiUnitOfMeasure.UNIDADE,
    UN: EpiUnitOfMeasure.UNIDADE,
    PAR: EpiUnitOfMeasure.PAR,
    PARES: EpiUnitOfMeasure.PAR,
    CAIXA: EpiUnitOfMeasure.CAIXA,
    CX: EpiUnitOfMeasure.CAIXA,
    KIT: EpiUnitOfMeasure.KIT,
  };
  const mapped = aliases[key];
  if (!mapped) {
    return {
      ok: false,
      message: `Unidade de medida invalida: "${value}". Use UNIDADE, PAR, CAIXA ou KIT.`,
    };
  }
  return { ok: true, value: mapped };
}

export function mapUsefulLifeUnit(
  value?: string | null,
):
  | { ok: true; value: EpiUsefulLifeUnit | undefined }
  | { ok: false; message: string } {
  if (!value || !value.trim()) {
    return { ok: true, value: undefined };
  }
  const key = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
  const aliases: Record<string, EpiUsefulLifeUnit> = {
    DIAS: EpiUsefulLifeUnit.DIAS,
    DIA: EpiUsefulLifeUnit.DIAS,
    MESES: EpiUsefulLifeUnit.MESES,
    MES: EpiUsefulLifeUnit.MESES,
    ANOS: EpiUsefulLifeUnit.ANOS,
    ANO: EpiUsefulLifeUnit.ANOS,
  };
  const mapped = aliases[key];
  if (!mapped) {
    return {
      ok: false,
      message: `Unidade de vida util invalida: "${value}". Use DIAS, MESES ou ANOS.`,
    };
  }
  return { ok: true, value: mapped };
}

export function mapCategory(
  value?: string | null,
): { ok: true; value: EpiCategory | undefined } | { ok: false; message: string } {
  if (!value || !value.trim()) {
    return { ok: true, value: undefined };
  }
  const key = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');
  const aliases: Record<string, EpiCategory> = {
    AUDITIVA: EpiCategory.AUDITIVA,
    RESPIRATORIA: EpiCategory.RESPIRATORIA,
    QUEDA: EpiCategory.QUEDA,
    MAOS: EpiCategory.MAOS,
    OLHOS: EpiCategory.OLHOS,
    CABECA: EpiCategory.CABECA,
    PES: EpiCategory.PES,
    TRONCO: EpiCategory.TRONCO,
    OUTROS: EpiCategory.OUTROS,
  };
  const mapped = aliases[key];
  if (!mapped) {
    return {
      ok: false,
      message: `Categoria invalida: "${value}".`,
    };
  }
  return { ok: true, value: mapped };
}

export function suggestCategoryFromEquipment(
  equipmentName: string | null | undefined,
): EpiCategory {
  const text = (equipmentName ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
  if (!text) return EpiCategory.OUTROS;
  if (text.includes('RESPIRADOR') || text.includes('RESPIRATORIO')) {
    return EpiCategory.RESPIRATORIA;
  }
  if (
    text.includes('PROTETOR AUDITIVO') ||
    text.includes('AUDITIVO') ||
    text.includes('AURICULAR')
  ) {
    return EpiCategory.AUDITIVA;
  }
  if (text.includes('LUVA')) return EpiCategory.MAOS;
  if (
    text.includes('OCULOS') ||
    text.includes('VISEIRA') ||
    text.includes('OCULAR') ||
    text.includes('PROTETOR FACIAL')
  ) {
    return EpiCategory.OLHOS;
  }
  if (text.includes('CAPACETE')) return EpiCategory.CABECA;
  if (
    text.includes('CALCADO') ||
    text.includes('BOTINA') ||
    text.includes('BOTA')
  ) {
    return EpiCategory.PES;
  }
  if (
    text.includes('CINTO') ||
    text.includes('TALABARTE') ||
    text.includes('QUEDA')
  ) {
    return EpiCategory.QUEDA;
  }
  if (
    text.includes('MACACAO') ||
    text.includes('AVENTAL') ||
    text.includes('VESTIMENTA')
  ) {
    return EpiCategory.TRONCO;
  }
  return EpiCategory.OUTROS;
}

export function suggestUnitFromEquipment(
  equipmentName: string | null | undefined,
): EpiUnitOfMeasure {
  const text = (equipmentName ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
  if (
    text.includes('LUVA') ||
    text.includes('CALCADO') ||
    text.includes('BOTINA') ||
    text.includes('BOTA') ||
    text.includes('PROTETOR AUDITIVO')
  ) {
    return EpiUnitOfMeasure.PAR;
  }
  return EpiUnitOfMeasure.UNIDADE;
}

export function buildTechnicalNotesFromCaepi(parts: {
  analysisNotes?: string | null;
  approvedFor?: string | null;
  restriction?: string | null;
  norms?: Array<{
    standard: string | null;
    reportNumber: string | null;
    laboratoryName: string | null;
  }>;
}): string | null {
  const chunks: string[] = [];
  if (parts.analysisNotes?.trim()) {
    chunks.push(parts.analysisNotes.trim());
  }
  if (parts.approvedFor?.trim()) {
    chunks.push(`Aprovado para: ${parts.approvedFor.trim()}`);
  }
  if (parts.restriction?.trim()) {
    chunks.push(`Restricao: ${parts.restriction.trim()}`);
  }
  if (parts.norms?.length) {
    const norms = parts.norms
      .map((norm) =>
        [norm.standard, norm.reportNumber ? `laudo ${norm.reportNumber}` : null, norm.laboratoryName]
          .filter(Boolean)
          .join(' — '),
      )
      .filter(Boolean);
    if (norms.length) {
      chunks.push(`Normas/laudos: ${norms.join('; ')}`);
    }
  }
  return chunks.length ? chunks.join('\n\n') : null;
}

export const EPI_CSV_TEMPLATE = `nome,ca,exige_ca,unidade,vida_util,unidade_vida_util,categoria,codigo_externo,tamanho,modelo
Protetor Auditivo Exemplo,45666,sim,PAR,6,MESES,AUDITIVA,EPI-AUD-001,Unico,PTS 350
Luva de Seguranca,,nao,PAR,90,DIAS,MAOS,EPI-MAO-010,M,Nitrilo
`;
