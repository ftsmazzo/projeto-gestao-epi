import type { ClientInitialAccess } from '@gestao-epi/shared';

const PREFIX = 'gestao-epi:client-access:';

export function storeClientAccessOnce(
  clientId: string,
  access: ClientInitialAccess,
) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(`${PREFIX}${clientId}`, JSON.stringify(access));
}

export function consumeClientAccessOnce(
  clientId: string,
): ClientInitialAccess | null {
  if (typeof window === 'undefined') return null;
  const key = `${PREFIX}${clientId}`;
  const raw = sessionStorage.getItem(key);
  if (!raw) return null;
  sessionStorage.removeItem(key);
  try {
    return JSON.parse(raw) as ClientInitialAccess;
  } catch {
    return null;
  }
}
