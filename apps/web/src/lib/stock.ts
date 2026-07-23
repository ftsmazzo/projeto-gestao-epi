import type {
  EpiCategory,
  EpiStockBalance,
  EpiStockMovement,
  EpiStockMovementType,
  EpiStockTotal,
  StockLocation,
  StockSummary,
} from '@gestao-epi/shared';
import { apiFetch } from './auth';

export type StockLocationInput = {
  name: string;
  description?: string | null;
};

export type StockMovementInput = {
  type: EpiStockMovementType;
  stockLocationId: string;
  epiItemId: string;
  epiVariantId?: string | null;
  quantity: number;
  reason?: string;
  notes?: string;
  minQuantity?: number | null;
};

export function listStockLocations() {
  return apiFetch<StockLocation[]>('/stock/locations');
}

export function createStockLocation(input: StockLocationInput) {
  return apiFetch<StockLocation>('/stock/locations', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateStockLocation(
  id: string,
  input: Partial<StockLocationInput>,
) {
  return apiFetch<StockLocation>(`/stock/locations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function updateStockLocationStatus(id: string, isActive: boolean) {
  return apiFetch<StockLocation>(`/stock/locations/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  });
}

export function getStockSummary() {
  return apiFetch<StockSummary>('/stock/summary');
}

export function listStockBalances(params?: {
  epiItemId?: string;
  stockLocationId?: string;
  category?: EpiCategory | '';
  lowOnly?: boolean;
}) {
  const query = new URLSearchParams();
  if (params?.epiItemId) query.set('epiItemId', params.epiItemId);
  if (params?.stockLocationId) {
    query.set('stockLocationId', params.stockLocationId);
  }
  if (params?.category) query.set('category', params.category);
  if (params?.lowOnly) query.set('lowOnly', 'true');
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiFetch<EpiStockBalance[]>(`/stock/balances${suffix}`);
}

export function listStockTotalsByEpi() {
  return apiFetch<EpiStockTotal[]>('/stock/totals-by-epi');
}

export function listStockMovements(params?: {
  epiItemId?: string;
  stockLocationId?: string;
  type?: EpiStockMovementType | '';
  limit?: number;
}) {
  const query = new URLSearchParams();
  if (params?.epiItemId) query.set('epiItemId', params.epiItemId);
  if (params?.stockLocationId) {
    query.set('stockLocationId', params.stockLocationId);
  }
  if (params?.type) query.set('type', params.type);
  if (params?.limit) query.set('limit', String(params.limit));
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiFetch<EpiStockMovement[]>(`/stock/movements${suffix}`);
}

export function createStockMovement(input: StockMovementInput) {
  return apiFetch<{
    movement: EpiStockMovement;
    balance: EpiStockBalance;
  }>('/stock/movements', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
