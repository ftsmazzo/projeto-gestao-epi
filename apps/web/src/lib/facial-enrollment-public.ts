import { getApiUrl } from './auth';
import type {
  PublicFacialEnrollmentCompleteResponse,
  PublicFacialEnrollmentUnlockResponse,
} from '@gestao-epi/shared';

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

/** Desbloqueia o link publico com os 4 ultimos digitos do CPF. */
export async function unlockFacialEnrollment(
  token: string,
  cpfLast4: string,
): Promise<PublicFacialEnrollmentUnlockResponse> {
  const response = await fetch(
    `${getApiUrl()}/public/facial-enrollment/${encodeURIComponent(token)}/unlock`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cpfLast4 }),
    },
  );
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as PublicFacialEnrollmentUnlockResponse;
}

/** Envia biometria + consentimento via link publico. */
export async function completeFacialEnrollment(
  token: string,
  file: Blob,
  options: {
    cpfLast4: string;
    consentAccepted: true;
    fileName?: string;
    faceDescriptor: number[];
    faceEngine?: string;
    faceEngineVersion?: string;
    qualityScore?: number | null;
  },
): Promise<PublicFacialEnrollmentCompleteResponse> {
  const form = new FormData();
  form.append('facial', file, options.fileName ?? 'facial-enrollment.jpg');
  form.append('cpfLast4', options.cpfLast4);
  form.append('consentAccepted', 'true');
  form.append('faceDescriptor', JSON.stringify(options.faceDescriptor));
  if (options.faceEngine) form.append('faceEngine', options.faceEngine);
  if (options.faceEngineVersion) {
    form.append('faceEngineVersion', options.faceEngineVersion);
  }
  if (
    typeof options.qualityScore === 'number' &&
    Number.isFinite(options.qualityScore)
  ) {
    form.append('qualityScore', String(options.qualityScore));
  }

  const response = await fetch(
    `${getApiUrl()}/public/facial-enrollment/${encodeURIComponent(token)}/complete`,
    { method: 'POST', body: form },
  );
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as PublicFacialEnrollmentCompleteResponse;
}
