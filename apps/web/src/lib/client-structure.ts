import type {
  ClientJobFunction,
  ClientSector,
  EpiRequirementSource,
  JobFunctionEpiRequirement,
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

export function listJobFunctionEpiRequirements(jobFunctionId: string) {
  return apiFetch<JobFunctionEpiRequirement[]>(
    `/client-job-functions/${jobFunctionId}/epi-requirements`,
  );
}

export function createJobFunctionEpiRequirement(
  jobFunctionId: string,
  input: {
    epiNeedId: string;
    riskId?: string | null;
    isRequired?: boolean;
    quantity?: number;
    replacementIntervalDays?: number | null;
    notes?: string | null;
    source?: EpiRequirementSource;
  },
) {
  return apiFetch<JobFunctionEpiRequirement>(
    `/client-job-functions/${jobFunctionId}/epi-requirements`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export function updateJobFunctionEpiRequirement(
  jobFunctionId: string,
  requirementId: string,
  input: {
    epiNeedId?: string;
    riskId?: string | null;
    isRequired?: boolean;
    quantity?: number;
    replacementIntervalDays?: number | null;
    notes?: string | null;
    source?: EpiRequirementSource;
  },
) {
  return apiFetch<JobFunctionEpiRequirement>(
    `/client-job-functions/${jobFunctionId}/epi-requirements/${requirementId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  );
}

export function updateJobFunctionEpiRequirementStatus(
  jobFunctionId: string,
  requirementId: string,
  isActive: boolean,
) {
  return apiFetch<JobFunctionEpiRequirement>(
    `/client-job-functions/${jobFunctionId}/epi-requirements/${requirementId}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    },
  );
}

export function deleteJobFunctionEpiRequirement(
  jobFunctionId: string,
  requirementId: string,
) {
  return apiFetch<{ ok: boolean }>(
    `/client-job-functions/${jobFunctionId}/epi-requirements/${requirementId}`,
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

/** Sugestoes de necessidades de EPI por nome de risco (nao aplicadas automaticamente). */
export const RISK_EPI_NEED_SUGGESTIONS: Record<string, string[]> = {
  ruido: ['Protetor Auricular Plug', 'Protetor Auricular Concha'],
  calor: ['Avental de Raspa', 'Luva de Vaqueta'],
  poeira: ['Respirador PFF2'],
  'corte/perfuracao': ['Luva de Vaqueta', 'Luva Nitrilica'],
  'queda de altura': ['Cinto de Seguranca', 'Talabarte'],
  'impacto nos olhos': ['Oculos de Seguranca', 'Viseira Facial'],
};

export function normalizeRiskKey(name: string) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function suggestedNeedNamesForRisk(riskName: string): string[] {
  const key = normalizeRiskKey(riskName);
  if (RISK_EPI_NEED_SUGGESTIONS[key]) {
    return RISK_EPI_NEED_SUGGESTIONS[key];
  }
  for (const [pattern, names] of Object.entries(RISK_EPI_NEED_SUGGESTIONS)) {
    if (
      key.includes(pattern) ||
      pattern.includes(key) ||
      key.includes(normalizeRiskKey(pattern))
    ) {
      return names;
    }
  }
  return [];
}
