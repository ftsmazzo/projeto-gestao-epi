import type { CaCertificateLookupResponse } from '@gestao-epi/shared';
import { apiFetch } from './auth';

export function lookupCaCertificate(caNumber: string) {
  const normalized = caNumber.trim().replace(/\s+/g, '');
  return apiFetch<CaCertificateLookupResponse>(
    `/caepi/certificates/${encodeURIComponent(normalized)}`,
  );
}
