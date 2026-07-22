import type { EpiItem, EpiItemStatus } from '@gestao-epi/shared';
import { apiFetch } from './auth';

export type EpiItemInput = {
  name: string;
  description?: string | null;
  caNumber?: string | null;
  caExpirationDate?: string | null;
  category?: string | null;
  manufacturer?: string | null;
  defaultValidityDays?: number | null;
  requiresCa?: boolean;
  notes?: string | null;
};

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

export function updateEpiItemStatus(id: string, status: EpiItemStatus) {
  return apiFetch<EpiItem>(`/epis/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}
