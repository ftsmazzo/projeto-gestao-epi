import type {
  EpiCategory,
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
