import type {
  ConfirmPgroImportPayload,
  PgroImportConfirmResult,
  PgroImportRun,
} from '@gestao-epi/shared';
import { apiFetch, getAccessToken, getApiUrl } from './auth';

export async function previewPgroImport(input: {
  file: File;
  servedClientId?: string | null;
}): Promise<PgroImportRun> {
  const form = new FormData();
  form.append('file', input.file);
  if (input.servedClientId) {
    form.append('servedClientId', input.servedClientId);
  }

  const headers = new Headers();
  const token = getAccessToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${getApiUrl()}/pgro/import/preview`, {
    method: 'POST',
    headers,
    body: form,
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

  return (await response.json()) as PgroImportRun;
}

export function getPgroImportRun(id: string) {
  return apiFetch<PgroImportRun>(`/pgro/import-runs/${id}`);
}

export function confirmPgroImport(id: string, payload: ConfirmPgroImportPayload) {
  return apiFetch<PgroImportConfirmResult>(`/pgro/import-runs/${id}/confirm`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
