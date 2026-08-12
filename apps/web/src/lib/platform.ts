import type {
  CreatePlatformTenantResult,
  PlatformOverview,
  PlatformTenantRow,
} from '@gestao-epi/shared';
import { platformFetch } from './platform-auth';

export function getPlatformOverview() {
  return platformFetch<PlatformOverview>('/platform/tenants');
}

export function createPlatformTenant(input: {
  name: string;
  ownerName: string;
  ownerEmail: string;
  contractedLifeQuota: number;
  wholesaleUnitPriceCents: number;
}) {
  return platformFetch<CreatePlatformTenantResult>('/platform/tenants', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updatePlatformTenant(
  id: string,
  input: {
    name?: string;
    contractedLifeQuota?: number;
    wholesaleUnitPriceCents?: number;
  },
) {
  return platformFetch<PlatformTenantRow>(`/platform/tenants/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function suspendPlatformTenant(id: string, reason?: string) {
  return platformFetch<PlatformTenantRow>(`/platform/tenants/${id}/suspend`, {
    method: 'POST',
    body: JSON.stringify({ reason: reason || undefined }),
  });
}

export function activatePlatformTenant(id: string) {
  return platformFetch<PlatformTenantRow>(`/platform/tenants/${id}/activate`, {
    method: 'POST',
  });
}
