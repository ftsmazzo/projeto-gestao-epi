import type {
  AuthResponse,
  AuthUser,
  SupportScope,
  SupportThreadView,
} from '@gestao-epi/shared';

const TOKEN_KEY = 'gestao-epi.accessToken';

export function getApiUrl() {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
}

export function getAccessToken() {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setAccessToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearAccessToken() {
  window.localStorage.removeItem(TOKEN_KEY);
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');

  const token = getAccessToken();
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
      // ignore parse errors
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function registerAccount(input: {
  name: string;
  email: string;
  password: string;
  organizationName: string;
  contractedLifeQuota?: number;
}) {
  const data = await apiFetch<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  setAccessToken(data.accessToken);
  return data;
}

export async function loginAccount(input: { email: string; password: string }) {
  const data = await apiFetch<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  setAccessToken(data.accessToken);
  return data;
}

export async function fetchMe() {
  return apiFetch<AuthUser>('/auth/me');
}

export async function changeConsultoriaPassword(input: {
  currentPassword: string;
  newPassword: string;
}) {
  return apiFetch<AuthUser>('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export type ForgotPasswordResponse = {
  ok: true;
  message: string;
  audience: 'portal' | 'consultoria';
  temporaryPassword: string | null;
  accessUrl: string | null;
  deliveryEnabled: boolean;
  channels?: {
    email: boolean;
    whatsapp: boolean;
  };
};

export async function requestPasswordReset(input: {
  email: string;
  audience: 'portal' | 'consultoria';
}) {
  return apiFetch<ForgotPasswordResponse>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function fetchSupportThread(input?: {
  scope?: SupportScope;
  servedClientId?: string;
}) {
  const params = new URLSearchParams();
  if (input?.scope) params.set('scope', input.scope);
  if (input?.servedClientId) params.set('servedClientId', input.servedClientId);
  const qs = params.toString();
  return apiFetch<SupportThreadView>(`/support/thread${qs ? `?${qs}` : ''}`);
}

export async function sendSupportMessage(input: {
  scope: SupportScope;
  body: string;
  servedClientId?: string;
}) {
  return apiFetch<SupportThreadView>('/support/message', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function escalateSupport(input: {
  scope: SupportScope;
  servedClientId?: string;
  reason?: string;
}) {
  return apiFetch<SupportThreadView>('/support/escalate', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function returnSupportToAi(input: {
  scope: SupportScope;
  servedClientId?: string;
}) {
  return apiFetch<SupportThreadView>('/support/return-ai', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
