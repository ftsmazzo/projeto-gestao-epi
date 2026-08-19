import type {
  TrainingAssetKind,
  TrainingGenerateInput,
  TrainingGenerationDefaults,
  TrainingIssuanceListResponse,
  TrainingTemplate,
  TrainingTemplateInput,
  TrainingTemplateListResponse,
} from '@gestao-epi/shared';
import { apiFetch, getAccessToken, getApiUrl } from './auth';

export function listTrainingTemplates() {
  return apiFetch<TrainingTemplateListResponse>('/training-templates');
}

export function getTrainingTemplate(id: string) {
  return apiFetch<TrainingTemplate>(`/training-templates/${id}`);
}

export function createTrainingTemplate(input: TrainingTemplateInput) {
  return apiFetch<TrainingTemplate>('/training-templates', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateTrainingTemplate(
  id: string,
  input: TrainingTemplateInput,
) {
  return apiFetch<TrainingTemplate>(`/training-templates/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function seedTrainingDefaults() {
  return apiFetch<TrainingTemplateListResponse>(
    '/training-templates/seed-defaults',
    { method: 'POST' },
  );
}

export function listTrainingIssuances() {
  return apiFetch<TrainingIssuanceListResponse>(
    '/training-templates/issuances',
  );
}

export function fetchTrainingGenerationDefaults(servedClientId: string) {
  return apiFetch<TrainingGenerationDefaults>(
    `/training-templates/generation-defaults?servedClientId=${encodeURIComponent(servedClientId)}`,
  );
}

export async function uploadTrainingAsset(
  templateId: string,
  kind: TrainingAssetKind,
  file: File,
) {
  const token = getAccessToken();
  const body = new FormData();
  body.append('file', file);
  const response = await fetch(
    `${getApiUrl()}/training-templates/${templateId}/assets/${kind}`,
    {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body,
    },
  );
  if (!response.ok) {
    let message = `Erro HTTP ${response.status}`;
    try {
      const payload = (await response.json()) as { message?: string | string[] };
      if (Array.isArray(payload.message)) message = payload.message.join(', ');
      else if (payload.message) message = payload.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  return (await response.json()) as TrainingTemplate;
}

export function deleteTrainingAsset(
  templateId: string,
  kind: TrainingAssetKind,
) {
  return apiFetch<TrainingTemplate>(
    `/training-templates/${templateId}/assets/${kind}`,
    { method: 'DELETE' },
  );
}

export async function fetchTrainingAssetObjectUrl(
  templateId: string,
  kind: TrainingAssetKind,
) {
  const token = getAccessToken();
  const response = await fetch(
    `${getApiUrl()}/training-templates/${templateId}/assets/${kind}`,
    { headers: token ? { Authorization: `Bearer ${token}` } : undefined },
  );
  if (!response.ok) return null;
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function downloadTrainingPdf(path: string, body?: unknown) {
  const token = getAccessToken();
  const response = await fetch(`${getApiUrl()}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    let message = `Erro HTTP ${response.status}`;
    try {
      const payload = (await response.json()) as { message?: string | string[] };
      if (Array.isArray(payload.message)) message = payload.message.join(', ');
      else if (payload.message) message = payload.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  const blob = await response.blob();
  const match = /filename="([^"]+)"/.exec(
    response.headers.get('Content-Disposition') ?? '',
  );
  triggerDownload(blob, match?.[1] ?? 'certificados.pdf');
}

export function generateTrainingPdf(
  templateId: string,
  input: TrainingGenerateInput,
) {
  return downloadTrainingPdf(`/training-templates/${templateId}/generate`, input);
}

export function reprintTrainingIssuance(id: string) {
  return downloadTrainingPdf(`/training-templates/issuances/${id}/pdf`);
}
