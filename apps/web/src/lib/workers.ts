import type {
  ClientLifeSummary,
  WorkerFacialReferenceMeta,
  WorkerImportConfirmResponse,
  WorkerImportConfirmRowInput,
  WorkerImportPreviewResponse,
  WorkerListItem,
  WorkerStatus,
} from '@gestao-epi/shared';
import { apiFetch, getAccessToken, getApiUrl } from './auth';
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

export function getWorkerFacialReference(workerId: string) {
  return apiFetch<WorkerFacialReferenceMeta>(
    `/workers/${workerId}/facial-reference`,
  );
}

export async function uploadWorkerFacialReference(
  workerId: string,
  file: Blob,
  options?: { consentAccepted?: boolean; fileName?: string },
) {
  const form = new FormData();
  form.append('facial', file, options?.fileName ?? 'facial-reference.jpg');
  if (options?.consentAccepted) {
    form.append('consentAccepted', 'true');
  }

  const headers = new Headers();
  const token = getAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(
    `${getApiUrl()}/workers/${workerId}/facial-reference`,
    { method: 'POST', headers, body: form },
  );
  if (!response.ok) {
    let message = `Erro HTTP ${response.status}`;
    try {
      const body = (await response.json()) as { message?: string | string[] };
      if (Array.isArray(body.message)) message = body.message.join(', ');
      else if (body.message) message = body.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  return (await response.json()) as WorkerFacialReferenceMeta;
}

export function revokeWorkerFacialReference(workerId: string) {
  return apiFetch<WorkerFacialReferenceMeta>(
    `/workers/${workerId}/facial-reference/revoke`,
    { method: 'PATCH' },
  );
}

/** Blob autenticado da referencia facial (Consultoria). */
export async function fetchWorkerFacialReferenceBlob(workerId: string) {
  const headers = new Headers();
  const token = getAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(
    `${getApiUrl()}/workers/${workerId}/facial-reference/image`,
    { headers },
  );
  if (!response.ok) {
    throw new Error('Nao foi possivel carregar a referencia facial.');
  }
  return response.blob();
}

export { downloadCsvText };
