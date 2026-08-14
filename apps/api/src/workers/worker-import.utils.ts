import type { WorkerStatus } from '@gestao-epi/shared';
import { sanitizeCsvCellText } from '../common/csv-text-encoding';
import {
  detectCsvDelimiter,
  parseCsvText,
} from '../epis/epi-import.utils';

export type WorkerCsvCanonicalField =
  | 'name'
  | 'cpf'
  | 'registration'
  | 'email'
  | 'phone'
  | 'admissionDate'
  | 'unit'
  | 'sector'
  | 'jobFunction'
  | 'status';

export function sanitizeImportedWorkerText(value: string): string {
  return sanitizeCsvCellText(value);
}

/**
 * Normaliza cabecalho CSV: remove acentos/cedilha, lower-case, espacos -> _,
 * pontuacao irrelevante removida. Ex.: "Função" -> "funcao", "E-mail" -> "e_mail".
 */
export function normalizeWorkerCsvHeaderKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ç/gi, 'c')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}

const COLUMN_ALIASES: Record<string, WorkerCsvCanonicalField> = {
  nome: 'name',
  name: 'name',
  trabalhador: 'name',
  colaborador: 'name',

  cpf: 'cpf',
  documento: 'cpf',
  doc: 'cpf',
  cpf_documento: 'cpf',

  matricula: 'registration',
  registration: 'registration',
  registrationnumber: 'registration',
  registration_number: 'registration',
  codigo: 'registration',
  code: 'registration',
  cod: 'registration',
  codigo_interno: 'registration',
  matricula_codigo: 'registration',

  email: 'email',
  e_mail: 'email',
  mail: 'email',
  correio: 'email',

  telefone: 'phone',
  phone: 'phone',
  celular: 'phone',
  whatsapp: 'phone',
  fone: 'phone',
  tel: 'phone',

  data_admissao: 'admissionDate',
  dataadmissao: 'admissionDate',
  admission_date: 'admissionDate',
  admissiondate: 'admissionDate',
  admissao: 'admissionDate',
  data_de_admissao: 'admissionDate',
  dt_admissao: 'admissionDate',

  unidade: 'unit',
  unit: 'unit',
  unidade_operacional: 'unit',
  filial: 'unit',

  setor: 'sector',
  sector: 'sector',
  departamento: 'sector',
  department: 'sector',
  area: 'sector',

  funcao: 'jobFunction',
  funcao_cargo: 'jobFunction',
  cargo: 'jobFunction',
  cargo_funcao: 'jobFunction',
  jobfunction: 'jobFunction',
  job_function: 'jobFunction',
  role: 'jobFunction',
  cargo_ou_funcao: 'jobFunction',

  status: 'status',
  situacao: 'status',
  situacao_cadastral: 'status',
};

export const WORKER_CSV_TEMPLATE = [
  'nome;cpf;matrícula;e-mail;telefone;admissão;unidade;setor;função;status',
  'Maria Silva;529.982.247-25;MAT-001;maria@empresa.com;11999990000;01/02/2024;Matriz;Producao;Operador;ACTIVE',
  'Joao Souza;111.444.777-35;MAT-002;joao@empresa.com;11988880000;15/03/2024;Matriz;Producao;Operador;INACTIVE',
].join('\n');

function resolveByHeuristic(
  key: string,
): WorkerCsvCanonicalField | null {
  if (!key) return null;
  if (key === 'nome' || key.startsWith('nome_') || key.includes('trabalhador')) {
    return 'name';
  }
  if (key.includes('cpf') || key.includes('documento')) {
    return 'cpf';
  }
  if (
    key.includes('matricula') ||
    key === 'codigo' ||
    key.startsWith('codigo_') ||
    key.includes('registration')
  ) {
    return 'registration';
  }
  if (key.includes('mail') || key === 'email' || key === 'e_mail') {
    return 'email';
  }
  if (
    key.includes('telefone') ||
    key.includes('celular') ||
    key.includes('whatsapp') ||
    key === 'fone' ||
    key === 'tel'
  ) {
    return 'phone';
  }
  if (key.includes('admiss')) {
    return 'admissionDate';
  }
  if (key.includes('unidade') || key === 'unit' || key.includes('filial')) {
    return 'unit';
  }
  if (
    key.includes('setor') ||
    key.includes('departamento') ||
    key === 'sector' ||
    key === 'department'
  ) {
    return 'sector';
  }
  if (
    key.includes('funcao') ||
    key.includes('cargo') ||
    key.includes('job') ||
    key === 'role'
  ) {
    return 'jobFunction';
  }
  if (key.includes('status') || key.includes('situacao')) {
    return 'status';
  }
  return null;
}

export function resolveWorkerCsvColumn(
  header: string,
): WorkerCsvCanonicalField | null {
  const key = normalizeWorkerCsvHeaderKey(header);
  if (!key) return null;
  return COLUMN_ALIASES[key] ?? resolveByHeuristic(key);
}

export function mapWorkerCsvRecord(
  headers: string[],
  cells: string[],
): {
  mapped: Partial<Record<WorkerCsvCanonicalField, string>>;
  unknownColumns: string[];
  raw: Record<string, string>;
} {
  const mapped: Partial<Record<WorkerCsvCanonicalField, string>> = {};
  const unknownColumns: string[] = [];
  const raw: Record<string, string> = {};

  headers.forEach((header, index) => {
    const value = sanitizeImportedWorkerText(cells[index] ?? '');
    raw[header] = value;
    const field = resolveWorkerCsvColumn(header);
    if (!field) {
      if (header.trim()) unknownColumns.push(header.trim());
      return;
    }
    if (value) {
      mapped[field] = value;
    }
  });

  return { mapped, unknownColumns, raw };
}

export { parseCsvText, detectCsvDelimiter };

export function normalizeMatchName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ç/gi, 'c')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function normalizeOptionalText(value?: string | null): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = sanitizeImportedWorkerText(value);
  return trimmed.length > 0 ? trimmed : null;
}

export function parseWorkerStatus(value?: string | null): WorkerStatus | null {
  if (value === undefined || value === null || value.trim() === '') {
    return 'ACTIVE';
  }
  const key = normalizeMatchName(value).replace(/\s+/g, '_');
  if (
    key === 'active' ||
    key === 'ativo' ||
    key === 'ativa' ||
    key === '1' ||
    key === 'sim' ||
    key === 'true'
  ) {
    return 'ACTIVE';
  }
  if (
    key === 'inactive' ||
    key === 'inativo' ||
    key === 'inativa' ||
    key === '0' ||
    key === 'nao' ||
    key === 'false'
  ) {
    return 'INACTIVE';
  }
  return null;
}

/** Aceita ISO (YYYY-MM-DD) ou BR (DD/MM/YYYY). Retorna ISO date string ou null. */
export function parseAdmissionDateInput(
  value?: string | null,
): { iso: string | null; error: string | null } {
  if (value === undefined || value === null || value.trim() === '') {
    return { iso: null, error: null };
  }
  const raw = value.trim();
  const br = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
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
      return { iso: null, error: 'Data de admissao invalida.' };
    }
    return { iso: date.toISOString().slice(0, 10), error: null };
  }

  const isoLike = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoLike) {
    const date = new Date(
      `${isoLike[1]}-${isoLike[2]}-${isoLike[3]}T00:00:00.000Z`,
    );
    if (Number.isNaN(date.getTime())) {
      return { iso: null, error: 'Data de admissao invalida.' };
    }
    return { iso: date.toISOString().slice(0, 10), error: null };
  }

  const fallback = new Date(raw);
  if (Number.isNaN(fallback.getTime())) {
    return { iso: null, error: 'Data de admissao invalida.' };
  }
  return { iso: fallback.toISOString().slice(0, 10), error: null };
}
