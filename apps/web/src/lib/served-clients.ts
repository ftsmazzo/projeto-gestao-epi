import type {
  QuotaSummary,
  ServedClient,
  ServedClientStatus,
} from '@gestao-epi/shared';
import { apiFetch } from './auth';

export type ServedClientInput = {
  legalName: string;
  tradeName?: string;
  cnpj: string;
  allocatedLifeQuota: number;
  status?: ServedClientStatus;
  notes?: string;
};

export function listServedClients() {
  return apiFetch<ServedClient[]>('/served-clients');
}

export function getQuotaSummary() {
  return apiFetch<QuotaSummary>('/served-clients/quota-summary');
}

export function getServedClient(id: string) {
  return apiFetch<ServedClient>(`/served-clients/${id}`);
}

export function createServedClient(input: ServedClientInput) {
  return apiFetch<ServedClient>('/served-clients', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateServedClient(
  id: string,
  input: Partial<ServedClientInput>,
) {
  return apiFetch<ServedClient>(`/served-clients/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function updateServedClientStatus(
  id: string,
  status: ServedClientStatus,
) {
  return apiFetch<ServedClient>(`/served-clients/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}
