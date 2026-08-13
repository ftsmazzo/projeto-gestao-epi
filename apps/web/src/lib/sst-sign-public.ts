import { getApiUrl } from './auth';
import type { PublicSstUnlockResponse } from '@gestao-epi/shared';
import type { LivenessChallengeType } from '@gestao-epi/shared';

async function readError(response: Response): Promise<string> {
  let message = `Erro HTTP ${response.status}`;
  try {
    const body = (await response.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) message = body.message.join(', ');
    else if (body.message) message = body.message;
  } catch {
    // ignore
  }
  return message;
}

export async function unlockSstDocument(
  token: string,
  cpfLast4: string,
): Promise<PublicSstUnlockResponse> {
  const response = await fetch(
    `${getApiUrl()}/public/sst-documents/${encodeURIComponent(token)}/unlock`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cpfLast4 }),
    },
  );
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as PublicSstUnlockResponse;
}

export async function completeSstDocumentSign(
  token: string,
  file: Blob,
  options: {
    cpfLast4: string;
    faceDescriptor: number[];
    faceEngine?: string;
    livenessPassed: true;
    livenessChallenge: LivenessChallengeType;
  },
) {
  const form = new FormData();
  form.append('facial', file, 'sst-sign.jpg');
  form.append('cpfLast4', options.cpfLast4);
  form.append('faceDescriptor', JSON.stringify(options.faceDescriptor));
  form.append('livenessPassed', 'true');
  form.append('livenessChallenge', options.livenessChallenge);
  if (options.faceEngine) form.append('faceEngine', options.faceEngine);

  const response = await fetch(
    `${getApiUrl()}/public/sst-documents/${encodeURIComponent(token)}/complete`,
    { method: 'POST', body: form },
  );
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as {
    ok: true;
    signedAt: string;
    documentTitle: string;
  };
}

export function sstSignedPdfUrl(token: string, cpfLast4: string) {
  return `${getApiUrl()}/public/sst-documents/${encodeURIComponent(token)}/pdf?cpfLast4=${encodeURIComponent(cpfLast4)}`;
}
