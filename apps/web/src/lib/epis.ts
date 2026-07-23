import type {
  EpiCategory,
  EpiImportConfirmResponse,
  EpiImportConfirmRowInput,
  EpiImportPreviewResponse,
  EpiItem,
  EpiUnitOfMeasure,
  EpiUsefulLifeUnit,
  EpiVariant,
} from '@gestao-epi/shared';
import { apiFetch } from './auth';

export type EpiVariantInput = {
  id?: string;
  size?: string | null;
  color?: string | null;
  model?: string | null;
  side?: string | null;
  notes?: string | null;
  isActive?: boolean;
};

export type EpiItemInput = {
  name: string;
  description?: string | null;
  requiresCa?: boolean;
  caNumber?: string | null;
  caExpiresAt?: string | null;
  unitOfMeasure?: EpiUnitOfMeasure;
  usefulLifeValue?: number | null;
  usefulLifeUnit?: EpiUsefulLifeUnit | null;
  category?: EpiCategory | null;
  externalCode?: string | null;
  manufacturerName?: string | null;
  reference?: string | null;
  color?: string | null;
  approvedFor?: string | null;
  restriction?: string | null;
  technicalNotes?: string | null;
  nrr?: number | null;
  nrrsf?: number | null;
  variants?: EpiVariantInput[];
};

export type { EpiVariant };

export const EPI_CSV_TEMPLATE_LOCAL = `nome,ca,exige_ca,unidade,vida_util,unidade_vida_util,categoria,codigo_externo,tamanho,modelo
Protetor Auditivo Exemplo,45666,sim,PAR,6,MESES,AUDITIVA,EPI-AUD-001,Unico,PTS 350
Luva de Seguranca,,nao,PAR,90,DIAS,MAOS,EPI-MAO-010,M,Nitrilo
`;

export function listEpiItems() {
  return apiFetch<EpiItem[]>('/epis');
}

export function getEpiItem(id: string) {
  return apiFetch<EpiItem>(`/epis/${id}`);
}

export function createEpiItem(input: EpiItemInput) {
  return apiFetch<EpiItem>('/epis', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateEpiItem(id: string, input: Partial<EpiItemInput>) {
  return apiFetch<EpiItem>(`/epis/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function updateEpiItemStatus(id: string, isActive: boolean) {
  return apiFetch<EpiItem>(`/epis/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  });
}

export function previewEpiCsvImport(csvText: string) {
  return apiFetch<EpiImportPreviewResponse>('/epis/import/preview', {
    method: 'POST',
    body: JSON.stringify({ csvText }),
  });
}

export function confirmEpiCsvImport(rows: EpiImportConfirmRowInput[]) {
  return apiFetch<EpiImportConfirmResponse>('/epis/import/confirm', {
    method: 'POST',
    body: JSON.stringify({ rows }),
  });
}

export function getEpiCsvTemplate() {
  return apiFetch<{
    fileName: string;
    contentType: string;
    csvText: string;
  }>('/epis/import/csv-template');
}

export function downloadCsvText(fileName: string, csvText: string) {
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
