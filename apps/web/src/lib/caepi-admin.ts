import type {
  CaepiImportRun,
  CaepiStatusResponse,
  CaepiSyncStartResponse,
} from '@gestao-epi/shared';
import { apiFetch, getAccessToken, getApiUrl } from './auth';

export function getCaepiStatus() {
  return apiFetch<CaepiStatusResponse>('/caepi/status');
}

export function listCaepiImportRuns(limit = 20) {
  return apiFetch<CaepiImportRun[]>(
    `/caepi/import-runs?limit=${encodeURIComponent(String(limit))}`,
  );
}

export function getCaepiImportRun(id: string) {
  return apiFetch<CaepiImportRun>(`/caepi/import-runs/${encodeURIComponent(id)}`);
}

export function startCaepiSync() {
  return apiFetch<CaepiSyncStartResponse>('/caepi/sync', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

/** Fallback: upload manual multipart (nao usa application/json). */
export async function uploadCaepiFile(file: File) {
  const headers = new Headers();
  const token = getAccessToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const form = new FormData();
  form.append('file', file);

  const response = await fetch(`${getApiUrl()}/caepi/import`, {
    method: 'POST',
    headers,
    body: form,
  });

  if (!response.ok) {
    let message = `Erro HTTP ${response.status}`;
    if (response.status === 413) {
      message =
        'Arquivo grande demais (too large). Prefira "Atualizar base CAEPI agora" ou envie o ZIP oficial, nao o TXT descompactado.';
    } else {
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
      if (/too large|file too large|payload/i.test(message)) {
        message =
          'Arquivo grande demais. Prefira "Atualizar base CAEPI agora" ou envie o ZIP oficial, nao o TXT.';
      }
    }
    throw new Error(message);
  }

  return (await response.json()) as CaepiSyncStartResponse;
}
