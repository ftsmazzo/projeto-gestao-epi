import type {
  PlatformSupportLifecycleStatus,
  PlatformSupportOverview,
  PlatformSupportThreadDetail,
  PlatformSupportThreadList,
  SupportScope,
} from '@gestao-epi/shared';
import { platformFetch } from './platform-auth';

export type PlatformSupportFilters = {
  status?: PlatformSupportLifecycleStatus | '';
  scope?: SupportScope | '';
  organizationId?: string;
  q?: string;
  page?: number;
  pageSize?: number;
};

export function getPlatformSupportOverview() {
  return platformFetch<PlatformSupportOverview>('/platform/support/overview');
}

export function getPlatformSupportThreads(
  filters: PlatformSupportFilters = {},
) {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.scope) params.set('scope', filters.scope);
  if (filters.organizationId) {
    params.set('organizationId', filters.organizationId);
  }
  if (filters.q?.trim()) params.set('q', filters.q.trim());
  if (filters.page) params.set('page', String(filters.page));
  if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
  const query = params.toString();
  return platformFetch<PlatformSupportThreadList>(
    `/platform/support/threads${query ? `?${query}` : ''}`,
  );
}

export function getPlatformSupportThread(
  threadId: string,
  page = 1,
  pageSize = 100,
) {
  return platformFetch<PlatformSupportThreadDetail>(
    `/platform/support/threads/${encodeURIComponent(threadId)}?page=${page}&pageSize=${pageSize}`,
  );
}

export function claimPlatformSupportThread(threadId: string) {
  return platformFetch<PlatformSupportThreadDetail>(
    `/platform/support/threads/${encodeURIComponent(threadId)}/claim`,
    { method: 'POST' },
  );
}

export function replyPlatformSupportThread(threadId: string, body: string) {
  return platformFetch<PlatformSupportThreadDetail>(
    `/platform/support/threads/${encodeURIComponent(threadId)}/reply`,
    { method: 'POST', body: JSON.stringify({ body }) },
  );
}

export function resolvePlatformSupportThread(threadId: string) {
  return platformFetch<PlatformSupportThreadDetail>(
    `/platform/support/threads/${encodeURIComponent(threadId)}/resolve`,
    { method: 'POST' },
  );
}

export function returnPlatformSupportThreadToAi(threadId: string) {
  return platformFetch<PlatformSupportThreadDetail>(
    `/platform/support/threads/${encodeURIComponent(threadId)}/return-ai`,
    { method: 'POST' },
  );
}
