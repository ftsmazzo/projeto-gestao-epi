import type { PlatformAuthResponse, PlatformAuthUser } from '@gestao-epi/shared';
import { getApiUrl } from './auth';

const TOKEN_KEY = 'gestao-epi.platformAccessToken';

export function getPlatformAccessToken() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setPlatformAccessToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearPlatformAccessToken() {
  window.localStorage.removeItem(TOKEN_KEY);
}

async function platformFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  const token = getPlatformAccessToken();
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

export async function loginPlatform(input: { email: string; password: string }) {
  const data = await platformFetch<PlatformAuthResponse>('/auth/platform/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  setPlatformAccessToken(data.accessToken);
  return data;
}

export function fetchPlatformMe() {
  return platformFetch<PlatformAuthUser>('/auth/platform/me');
}

export { platformFetch };
