import type {
  EpiCategory,
  EpiItemNeedLink,
  EpiNeed,
  EpiNeedDefaultsResult,
  EpiNeedDetail,
  EpiNeedMatchResult,
} from '@gestao-epi/shared';
import { apiFetch } from './auth';

export type EpiNeedInput = {
  name: string;
  category?: EpiCategory | null;
  description?: string | null;
  aliases?: string[];
};

export function listEpiNeeds(params?: {
  q?: string;
  category?: EpiCategory | '';
  status?: 'active' | 'inactive' | 'all';
}) {
  const query = new URLSearchParams();
  if (params?.q) query.set('q', params.q);
  if (params?.category) query.set('category', params.category);
  if (params?.status) query.set('status', params.status);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiFetch<EpiNeed[]>(`/epi-needs${suffix}`);
}

export function getEpiNeed(id: string) {
  return apiFetch<EpiNeedDetail>(`/epi-needs/${id}`);
}

export function createEpiNeed(input: EpiNeedInput) {
  return apiFetch<EpiNeed>('/epi-needs', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateEpiNeed(id: string, input: Partial<EpiNeedInput>) {
  return apiFetch<EpiNeed>(`/epi-needs/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function updateEpiNeedStatus(id: string, isActive: boolean) {
  return apiFetch<EpiNeed>(`/epi-needs/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  });
}

export function suggestEpiNeedDefaults() {
  return apiFetch<EpiNeedDefaultsResult>('/epi-needs/suggest-defaults', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function matchEpiNeeds(input: {
  name?: string;
  description?: string;
  category?: string;
  reference?: string;
  equipmentName?: string;
  color?: string;
  technicalNotes?: string;
}) {
  return apiFetch<EpiNeedMatchResult>('/epi-needs/match', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function linkEpiToNeed(
  needId: string,
  input: { epiItemId: string; isPrimary?: boolean; notes?: string },
) {
  return apiFetch<EpiItemNeedLink>(`/epi-needs/${needId}/items`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function unlinkEpiFromNeed(needId: string, epiItemId: string) {
  return apiFetch<{ ok: boolean }>(`/epi-needs/${needId}/items/${epiItemId}`, {
    method: 'DELETE',
  });
}

export function listNeedsByEpiItem(epiItemId: string) {
  return apiFetch<EpiItemNeedLink[]>(`/epi-needs/item/${epiItemId}`);
}

export function syncNeedsForEpiItem(epiItemId: string, needIds: string[]) {
  return apiFetch<EpiItemNeedLink[]>(`/epi-needs/item/${epiItemId}`, {
    method: 'PUT',
    body: JSON.stringify({ needIds }),
  });
}
