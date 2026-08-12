import type {
  LifePriceQuote,
  SubscriptionsOverview,
} from '@gestao-epi/shared';
import { apiFetch } from './auth';

export function getSubscriptionsOverview() {
  return apiFetch<SubscriptionsOverview>('/subscriptions');
}

export function previewLifeQuote(lives: number) {
  return apiFetch<LifePriceQuote>(
    `/subscriptions/quote?lives=${encodeURIComponent(String(lives))}`,
  );
}

export function updateLifePricing(input: {
  unitPriceCents?: number;
  defaultTrialDays?: number;
  defaultTrialLives?: number;
  contractedLifeQuota?: number;
}) {
  return apiFetch<SubscriptionsOverview>('/subscriptions/pricing', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function replaceLifeReducers(
  items: Array<{ minLives: number; percentOff: number; label?: string | null }>,
) {
  return apiFetch<SubscriptionsOverview>('/subscriptions/pricing/reducers', {
    method: 'PUT',
    body: JSON.stringify({ items }),
  });
}

export function startClientTrial(
  clientId: string,
  input: { days?: number; lives?: number },
) {
  return apiFetch<SubscriptionsOverview>(
    `/subscriptions/clients/${encodeURIComponent(clientId)}/trial`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function activateClientSubscription(
  clientId: string,
  input: { lives: number; monthlyPriceCentsOverride?: number | null },
) {
  return apiFetch<SubscriptionsOverview>(
    `/subscriptions/clients/${encodeURIComponent(clientId)}/activate`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function grantClientLives(clientId: string, extraLives: number) {
  return apiFetch<SubscriptionsOverview>(
    `/subscriptions/clients/${encodeURIComponent(clientId)}/grant-lives`,
    { method: 'POST', body: JSON.stringify({ extraLives }) },
  );
}

export function adjustClientMonthly(
  clientId: string,
  monthlyPriceCents: number | null,
) {
  return apiFetch<SubscriptionsOverview>(
    `/subscriptions/clients/${encodeURIComponent(clientId)}/monthly`,
    { method: 'POST', body: JSON.stringify({ monthlyPriceCents }) },
  );
}

export function markClientPastDue(clientId: string) {
  return apiFetch<SubscriptionsOverview>(
    `/subscriptions/clients/${encodeURIComponent(clientId)}/past-due`,
    { method: 'POST', body: '{}' },
  );
}

export function suspendClientSubscription(clientId: string, reason?: string) {
  return apiFetch<SubscriptionsOverview>(
    `/subscriptions/clients/${encodeURIComponent(clientId)}/suspend`,
    { method: 'POST', body: JSON.stringify({ reason }) },
  );
}

export function reactivateClientSubscription(
  clientId: string,
  lives?: number,
) {
  return apiFetch<SubscriptionsOverview>(
    `/subscriptions/clients/${encodeURIComponent(clientId)}/reactivate`,
    { method: 'POST', body: JSON.stringify(lives ? { lives } : {}) },
  );
}

export function reaisToCents(raw: string) {
  const normalized = raw.trim().replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

export function centsToReaisInput(cents: number) {
  return (cents / 100).toFixed(2).replace('.', ',');
}
