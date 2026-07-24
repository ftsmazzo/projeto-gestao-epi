import type {
  ClientLifeSummary,
  WorkerImportConfirmResponse,
  WorkerImportConfirmRowInput,
  WorkerImportPreviewResponse,
  WorkerListItem,
  WorkerStatus,
} from '@gestao-epi/shared';
import { apiFetch } from './auth';
import { downloadCsvText } from './epis';

export type WorkerInput = {
  name: string;
  cpf?: string | null;
  registration?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  department?: string | null;
  operationalUnitId?: string | null;
  clientSectorId?: string | null;
  clientJobFunctionId?: string | null;
  status?: WorkerStatus;
  admissionDate?: string | null;
  notes?: string | null;
};

export function listWorkers(servedClientId: string) {
  return apiFetch<WorkerListItem[]>(
    `/served-clients/${servedClientId}/workers`,
  );
}

export function getClientLifeSummary(servedClientId: string) {
  return apiFetch<ClientLifeSummary>(
    `/served-clients/${servedClientId}/life-summary`,
  );
}

export function getWorker(id: string) {
  return apiFetch<WorkerListItem>(`/workers/${id}`);
}

export function createWorker(servedClientId: string, input: WorkerInput) {
  return apiFetch<WorkerListItem>(
    `/served-clients/${servedClientId}/workers`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export function updateWorker(id: string, input: Partial<WorkerInput>) {
  return apiFetch<WorkerListItem>(`/workers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function updateWorkerStatus(id: string, status: WorkerStatus) {
  return apiFetch<WorkerListItem>(`/workers/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export function getWorkerCsvTemplate(servedClientId: string) {
  return apiFetch<{
    fileName: string;
    contentType: string;
    csvText: string;
  }>(`/served-clients/${servedClientId}/workers/import/csv-template`);
}

export function previewWorkerCsvImport(
  servedClientId: string,
  csvText: string,
) {
  return apiFetch<WorkerImportPreviewResponse>(
    `/served-clients/${servedClientId}/workers/import/preview`,
    {
      method: 'POST',
      body: JSON.stringify({ csvText }),
    },
  );
}

export function confirmWorkerCsvImport(
  servedClientId: string,
  rows: WorkerImportConfirmRowInput[],
) {
  return apiFetch<WorkerImportConfirmResponse>(
    `/served-clients/${servedClientId}/workers/import/confirm`,
    {
      method: 'POST',
      body: JSON.stringify({ rows }),
    },
  );
}

export { downloadCsvText };
