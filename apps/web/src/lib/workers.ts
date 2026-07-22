import type {
  ClientLifeSummary,
  Worker,
  WorkerStatus,
} from '@gestao-epi/shared';
import { apiFetch } from './auth';

export type WorkerInput = {
  name: string;
  cpf?: string | null;
  registration?: string | null;
  role?: string | null;
  department?: string | null;
  operationalUnitId?: string | null;
  status?: WorkerStatus;
  admissionDate?: string | null;
  notes?: string | null;
};

export function listWorkers(servedClientId: string) {
  return apiFetch<Worker[]>(`/served-clients/${servedClientId}/workers`);
}

export function getClientLifeSummary(servedClientId: string) {
  return apiFetch<ClientLifeSummary>(
    `/served-clients/${servedClientId}/life-summary`,
  );
}

export function getWorker(id: string) {
  return apiFetch<Worker>(`/workers/${id}`);
}

export function createWorker(servedClientId: string, input: WorkerInput) {
  return apiFetch<Worker>(`/served-clients/${servedClientId}/workers`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateWorker(id: string, input: Partial<WorkerInput>) {
  return apiFetch<Worker>(`/workers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function updateWorkerStatus(id: string, status: WorkerStatus) {
  return apiFetch<Worker>(`/workers/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}
