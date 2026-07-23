import type {
  ClientJobFunction,
  ClientSector,
  JobFunctionRiskLink,
  OccupationalRisk,
  OccupationalRiskCategory,
  OccupationalRiskDefaultsResult,
  RiskLevel,
} from '@gestao-epi/shared';
import { apiFetch } from './auth';

export function listClientSectors(
  servedClientId: string,
  status: 'all' | 'active' | 'inactive' = 'all',
) {
  const query = new URLSearchParams({ servedClientId, status });
  return apiFetch<ClientSector[]>(`/client-sectors?${query.toString()}`);
}

export function createClientSector(input: {
  servedClientId: string;
  operationalUnitId?: string | null;
  name: string;
  description?: string | null;
}) {
  return apiFetch<ClientSector>('/client-sectors', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateClientSector(
  id: string,
  input: {
    operationalUnitId?: string | null;
    name?: string;
    description?: string | null;
  },
) {
  return apiFetch<ClientSector>(`/client-sectors/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function updateClientSectorStatus(id: string, isActive: boolean) {
  return apiFetch<ClientSector>(`/client-sectors/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  });
}

export function listClientJobFunctions(params: {
  servedClientId: string;
  sectorId?: string;
  status?: 'all' | 'active' | 'inactive';
}) {
  const query = new URLSearchParams({
    servedClientId: params.servedClientId,
  });
  if (params.sectorId) query.set('sectorId', params.sectorId);
  if (params.status) query.set('status', params.status);
  return apiFetch<ClientJobFunction[]>(
    `/client-job-functions?${query.toString()}`,
  );
}

export function createClientJobFunction(input: {
  servedClientId: string;
  sectorId: string;
  name: string;
  description?: string | null;
  environmentDescription?: string | null;
}) {
  return apiFetch<ClientJobFunction>('/client-job-functions', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateClientJobFunction(
  id: string,
  input: {
    sectorId?: string;
    name?: string;
    description?: string | null;
    environmentDescription?: string | null;
  },
) {
  return apiFetch<ClientJobFunction>(`/client-job-functions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function updateClientJobFunctionStatus(id: string, isActive: boolean) {
  return apiFetch<ClientJobFunction>(`/client-job-functions/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  });
}

export function linkJobFunctionRisk(
  jobFunctionId: string,
  input: {
    riskId: string;
    exposure?: string;
    source?: string;
    possibleDamage?: string;
    riskLevel?: RiskLevel;
    notes?: string;
  },
) {
  return apiFetch<JobFunctionRiskLink>(
    `/client-job-functions/${jobFunctionId}/risks`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export function unlinkJobFunctionRisk(jobFunctionId: string, riskId: string) {
  return apiFetch<{ ok: boolean }>(
    `/client-job-functions/${jobFunctionId}/risks/${riskId}`,
    { method: 'DELETE' },
  );
}

export function listOccupationalRisks(params?: {
  q?: string;
  category?: OccupationalRiskCategory | '';
  status?: 'all' | 'active' | 'inactive';
}) {
  const query = new URLSearchParams();
  if (params?.q) query.set('q', params.q);
  if (params?.category) query.set('category', params.category);
  if (params?.status) query.set('status', params.status);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiFetch<OccupationalRisk[]>(`/occupational-risks${suffix}`);
}

export function createOccupationalRisk(input: {
  name: string;
  category: OccupationalRiskCategory;
  description?: string | null;
  aliases?: string[];
}) {
  return apiFetch<OccupationalRisk>('/occupational-risks', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function suggestOccupationalRiskDefaults() {
  return apiFetch<OccupationalRiskDefaultsResult>(
    '/occupational-risks/suggest-defaults',
    { method: 'POST', body: JSON.stringify({}) },
  );
}

export function updateOccupationalRiskStatus(id: string, isActive: boolean) {
  return apiFetch<OccupationalRisk>(`/occupational-risks/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  });
}
