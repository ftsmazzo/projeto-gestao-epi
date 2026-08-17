import type {
  ClientGroup,
  ClientGroupAccessResult,
  ClientUserRole,
} from '@gestao-epi/shared';
import { apiFetch } from './auth';

export function listClientGroups() {
  return apiFetch<ClientGroup[]>('/client-groups');
}

export function getClientGroup(id: string) {
  return apiFetch<ClientGroup>(`/client-groups/${id}`);
}

export function createClientGroup(input: { name: string; notes?: string }) {
  return apiFetch<ClientGroup>('/client-groups', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateClientGroup(
  id: string,
  input: { name?: string; notes?: string | null },
) {
  return apiFetch<ClientGroup>(`/client-groups/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteClientGroup(id: string) {
  return apiFetch<{ ok: true }>(`/client-groups/${id}`, {
    method: 'DELETE',
  });
}

export function setClientGroupClients(id: string, servedClientIds: string[]) {
  return apiFetch<ClientGroup>(`/client-groups/${id}/clients`, {
    method: 'PUT',
    body: JSON.stringify({ servedClientIds }),
  });
}

export function grantClientGroupAccess(
  id: string,
  input: {
    name: string;
    email: string;
    phone?: string;
    role: Exclude<ClientUserRole, 'WORKER'>;
    servedClientIds: string[];
  },
) {
  return apiFetch<ClientGroupAccessResult>(`/client-groups/${id}/access`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
