import type { WorkerStatus } from '@gestao-epi/shared';
import {
  detectCsvDelimiter,
  normalizeCsvHeaderKey,
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

const COLUMN_ALIASES: Record<string, WorkerCsvCanonicalField> = {
  nome: 'name',
  name: 'name',
  cpf: 'cpf',
  documento: 'cpf',
  matricula: 'registration',
  registration: 'registration',
  registrationnumber: 'registration',
  registration_number: 'registration',
  codigo: 'registration',
  code: 'registration',
  email: 'email',
  e_mail: 'email',
  telefone: 'phone',
  phone: 'phone',
  celular: 'phone',
  data_admissao: 'admissionDate',
  dataadmissao: 'admissionDate',
  admission_date: 'admissionDate',
  admissiondate: 'admissionDate',
  admissao: 'admissionDate',
  unidade: 'unit',
  unit: 'unit',
  setor: 'sector',
  sector: 'sector',
  departamento: 'sector',
  department: 'sector',
  funcao: 'jobFunction',
  funcao_cargo: 'jobFunction',
  cargo: 'jobFunction',
  jobfunction: 'jobFunction',
  job_function: 'jobFunction',
  role: 'jobFunction',
  status: 'status',
  situacao: 'status',
};

export const WORKER_CSV_TEMPLATE = [
  'nome;cpf;matricula;email;telefone;data_admissao;unidade;setor;funcao;status',
  'Maria Silva;529.982.247-25;MAT-001;maria@empresa.com;11999990000;01/02/2024;Matriz;Producao;Operador;ACTIVE',
  'Joao Souza;111.444.777-35;MAT-002;joao@empresa.com;11988880000;15/03/2024;Matriz;Producao;Operador;INACTIVE',
].join('\n');

export function resolveWorkerCsvColumn(
  header: string,
): WorkerCsvCanonicalField | null {
  const key = normalizeCsvHeaderKey(header);
  return COLUMN_ALIASES[key] ?? null;
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
    const value = (cells[index] ?? '').trim();
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

export { parseCsvText, detectCsvDelimiter, normalizeCsvHeaderKey };

export function normalizeMatchName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function normalizeOptionalText(value?: string | null): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
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
    const date = new Date(`${isoLike[1]}-${isoLike[2]}-${isoLike[3]}T00:00:00.000Z`);
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
