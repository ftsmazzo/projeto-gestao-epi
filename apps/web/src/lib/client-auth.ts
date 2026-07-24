import type {
  ClientAuthResponse,
  ClientPortalUser,
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
