import type {
  ClientAuthResponse,
  ClientPortalUser,
  CaCertificateSearchResponse,
  PortalDashboardResponse,
  PortalEpiByCaResponse,
  PortalEpiSearchItem,
  PortalEstoqueResponse,
  PortalEstruturaResponse,
  PortalStockEntradasResult,
  PortalTrabalhadoresResponse,
  PortalValidadeResponse,
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
  headers.set('Content-Type', 'application/json');

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
