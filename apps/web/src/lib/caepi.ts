import type {
  CaCertificateLookupResponse,
  CaCertificateSearchResponse,
} from '@gestao-epi/shared';
import { apiFetch } from './auth';

export function normalizeCaQuery(value: string) {
  return value.trim().replace(/\s+/g, '');
}

export function lookupCaCertificate(caNumber: string) {
  const normalized = normalizeCaQuery(caNumber);
  return apiFetch<CaCertificateLookupResponse>(
    `/caepi/certificates/${encodeURIComponent(normalized)}`,
  );
}

export function searchCaCertificates(q: string, limit = 10) {
  const params = new URLSearchParams({
    q: q.trim(),
    limit: String(limit),
  });
  return apiFetch<CaCertificateSearchResponse>(
    `/caepi/certificates/search?${params.toString()}`,
  );
}
