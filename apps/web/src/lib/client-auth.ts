import type {
  ClientAuthResponse,
  ClientPortalUser,
  CaCertificateSearchResponse,
  PortalDashboardResponse,
  PortalDeliveryDetail,
  PortalDeliveriesListResponse,
  PortalCreateDeliveryPayload,
  PortalEpiByCaResponse,
  PortalEpiCoverageResponse,
  PortalEpiSearchItem,
  PortalEntregasPreparacaoResponse,
  PortalEstoqueResponse,
  PortalEstruturaResponse,
  PortalReportFiltersMeta,
  PortalReportFiltersQuery,
  PortalReportsCoverageResponse,
  PortalReportsDeliveriesResponse,
  PortalReportsOverviewResponse,
  PortalReportsReturnsResponse,
  PortalReportsStockResponse,
  PortalStockEntradasResult,
  PortalTrabalhadoresResponse,
  PortalValidadeResponse,
  PortalWorkerEpiSheetResponse,
  WorkerFacialEnrollmentLinkGenerated,
  WorkerFacialEnrollmentLinkStatusResponse,
} from '@gestao-epi/shared';
import { getApiUrl } from './auth';

const CLIENT_TOKEN_KEY = 'gestao-epi.clientAccessToken';

export function getClientAccessToken() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(CLIENT_TOKEN_KEY);
}

export function setClientAccessToken(token: string) {
  window.localStorage.setItem(CLIENT_TOKEN_KEY, token);
}

export function clearClientAccessToken() {
  window.localStorage.removeItem(CLIENT_TOKEN_KEY);
}

async function clientApiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const token = getClientAccessToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${getApiUrl()}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let message = `Erro HTTP ${response.status}`;
    try {
      const body = (await response.json()) as { message?: string | string[] };
      if (Array.isArray(body.message)) {
        message = body.message.join(', ');
      } else if (body.message) {
        message = body.message;
      }
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function clientLoginAccount(input: {
  email: string;
  password: string;
}) {
  const data = await clientApiFetch<ClientAuthResponse>('/auth/client/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  setClientAccessToken(data.accessToken);
  return data;
}

export async function fetchClientMe() {
  return clientApiFetch<ClientPortalUser>('/auth/client/me');
}

export async function changeClientPassword(input: {
  currentPassword: string;
  newPassword: string;
}) {
  return clientApiFetch<ClientPortalUser>('/auth/client/change-password', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function fetchPortalDashboard() {
  return clientApiFetch<PortalDashboardResponse>('/portal/dashboard');
}

export async function fetchPortalValidade() {
  return clientApiFetch<PortalValidadeResponse>('/portal/validade');
}

export async function fetchPortalEstrutura() {
  return clientApiFetch<PortalEstruturaResponse>('/portal/estrutura');
}

export async function fetchPortalTrabalhadores() {
  return clientApiFetch<PortalTrabalhadoresResponse>('/portal/trabalhadores');
}

export type PortalWorkerInput = {
  name: string;
  cpf?: string | null;
  registration?: string | null;
  email?: string | null;
  phone?: string | null;
  operationalUnitId?: string | null;
  clientSectorId?: string | null;
  clientJobFunctionId?: string | null;
  admissionDate?: string | null;
  notes?: string | null;
  status?: 'ACTIVE' | 'INACTIVE';
};

export async function createPortalWorker(input: PortalWorkerInput) {
  return clientApiFetch('/portal/trabalhadores', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updatePortalWorker(
  id: string,
  input: Partial<PortalWorkerInput>,
) {
  return clientApiFetch(`/portal/trabalhadores/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function updatePortalWorkerStatus(
  id: string,
  status: 'ACTIVE' | 'INACTIVE',
) {
  return clientApiFetch(`/portal/trabalhadores/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function fetchPortalWorkerFacialEnrollmentLink(workerId: string) {
  return clientApiFetch<WorkerFacialEnrollmentLinkStatusResponse>(
    `/portal/trabalhadores/${workerId}/facial-enrollment-link`,
  );
}

export async function generatePortalWorkerFacialEnrollmentLink(
  workerId: string,
) {
  return clientApiFetch<WorkerFacialEnrollmentLinkGenerated>(
    `/portal/trabalhadores/${workerId}/facial-enrollment-link`,
    { method: 'POST' },
  );
}

export async function fetchPortalWorkerEpiSheet(
  workerId: string,
  scope: 'history' | 'open' = 'history',
  period?: { from?: string; to?: string },
) {
  const params = new URLSearchParams();
  if (scope === 'open') params.set('scope', 'open');
  if (period?.from?.trim()) params.set('from', period.from.trim());
  if (period?.to?.trim()) params.set('to', period.to.trim());
  const query = params.toString();
  return clientApiFetch<PortalWorkerEpiSheetResponse>(
    `/portal/trabalhadores/${workerId}/ficha-epi${query ? `?${query}` : ''}`,
  );
}

export async function fetchPortalEntregasPreparacao() {
  return clientApiFetch<PortalEntregasPreparacaoResponse>(
    '/portal/entregas/preparacao',
  );
}

export async function fetchPortalWorkerEpiCoverage(workerId: string) {
  return clientApiFetch<PortalEpiCoverageResponse>(
    `/portal/trabalhadores/${workerId}/epi-coverage`,
  );
}

export async function fetchPortalDeliveries(status?: string) {
  const params = status ? `?status=${encodeURIComponent(status)}` : '';
  return clientApiFetch<PortalDeliveriesListResponse>(
    `/portal/entregas${params}`,
  );
}

export async function fetchPortalDelivery(id: string) {
  return clientApiFetch<PortalDeliveryDetail>(`/portal/entregas/${id}`);
}

export async function cancelPortalDelivery(id: string, reason: string) {
  return clientApiFetch<PortalDeliveryDetail>(`/portal/entregas/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function createPortalDeliveryReturn(
  id: string,
  payload: {
    reason: string;
    notes?: string | null;
    items: Array<{
      deliveryItemId: string;
      quantity: number;
      condition: 'REUSABLE' | 'DAMAGED' | 'DISCARDED' | 'LOST';
    }>;
  },
) {
  return clientApiFetch<PortalDeliveryDetail>(
    `/portal/entregas/${id}/returns`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export async function createPortalDelivery(
  payload: PortalCreateDeliveryPayload,
  facialBlob: Blob,
  facialFileName = 'facial-capture.jpg',
) {
  const form = new FormData();
  form.append('payload', JSON.stringify(payload));
  form.append('facial', facialBlob, facialFileName);
  return clientApiFetch<PortalDeliveryDetail>('/portal/entregas', {
    method: 'POST',
    body: form,
  });
}

/** Preview de matching biometrico (sem concluir entrega). */
export async function previewPortalFacialMatch(
  workerId: string,
  faceDescriptor: number[],
) {
  return clientApiFetch<{
    matched: boolean;
    distance: number;
    threshold: number;
    status: 'MATCHED' | 'REJECTED';
    message: string;
  }>(`/portal/trabalhadores/${workerId}/facial-match`, {
    method: 'POST',
    body: JSON.stringify({ faceDescriptor }),
  });
}

/** Fetch autenticado da evidencia facial (blob; nao logar conteudo). */
export async function fetchPortalDeliveryFacialBlob(deliveryId: string) {
  const headers = new Headers();
  const token = getClientAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(
    `${getApiUrl()}/portal/entregas/${deliveryId}/evidence/facial`,
    { headers },
  );
  if (!response.ok) {
    throw new Error('Nao foi possivel carregar a evidencia facial.');
  }
  return response.blob();
}

/** Referencia facial do trabalhador no portal (stream autenticado). */
export async function fetchPortalWorkerFacialReferenceBlob(workerId: string) {
  const headers = new Headers();
  const token = getClientAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(
    `${getApiUrl()}/portal/trabalhadores/${workerId}/facial-reference`,
    { headers },
  );
  if (!response.ok) {
    throw new Error(
      'Nao foi possivel carregar a referencia facial do trabalhador.',
    );
  }
  return response.blob();
}

export async function fetchPortalEstoque() {
  return clientApiFetch<PortalEstoqueResponse>('/portal/estoque');
}

export async function searchPortalEpis(q: string) {
  const params = new URLSearchParams({ q });
  return clientApiFetch<PortalEpiSearchItem[]>(
    `/portal/epis/search?${params.toString()}`,
  );
}

export async function lookupPortalEpiByCa(ca: string) {
  const params = new URLSearchParams({ ca });
  return clientApiFetch<PortalEpiByCaResponse>(
    `/portal/epis/by-ca?${params.toString()}`,
  );
}

export async function searchPortalCaepi(q: string, limit = 12) {
  const params = new URLSearchParams({
    q: q.trim(),
    limit: String(limit),
  });
  return clientApiFetch<CaCertificateSearchResponse>(
    `/portal/caepi/search?${params.toString()}`,
  );
}

export async function createPortalStockEntradas(
  items: Array<{
    epiItemId?: string;
    epiNeedId?: string;
    caNumber?: string;
    quantity: number;
  }>,
) {
  return clientApiFetch<PortalStockEntradasResult>('/portal/stock/entradas', {
    method: 'POST',
    body: JSON.stringify({ items }),
  });
}

function portalReportQuery(filters: PortalReportFiltersQuery = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value != null && String(value).trim() !== '') {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export async function fetchPortalReportFilters() {
  return clientApiFetch<PortalReportFiltersMeta>('/portal/reports/filters');
}

export async function fetchPortalReportsOverview(
  filters: PortalReportFiltersQuery = {},
) {
  return clientApiFetch<PortalReportsOverviewResponse>(
    `/portal/reports/overview${portalReportQuery(filters)}`,
  );
}

export async function fetchPortalReportsDeliveries(
  filters: PortalReportFiltersQuery = {},
) {
  return clientApiFetch<PortalReportsDeliveriesResponse>(
    `/portal/reports/deliveries${portalReportQuery(filters)}`,
  );
}

export async function fetchPortalReportsStock(
  filters: PortalReportFiltersQuery = {},
) {
  return clientApiFetch<PortalReportsStockResponse>(
    `/portal/reports/stock${portalReportQuery(filters)}`,
  );
}

export async function fetchPortalReportsReturns(
  filters: PortalReportFiltersQuery = {},
) {
  return clientApiFetch<PortalReportsReturnsResponse>(
    `/portal/reports/returns${portalReportQuery(filters)}`,
  );
}

export async function fetchPortalReportsCoverage(
  filters: PortalReportFiltersQuery = {},
) {
  return clientApiFetch<PortalReportsCoverageResponse>(
    `/portal/reports/coverage${portalReportQuery(filters)}`,
  );
}
