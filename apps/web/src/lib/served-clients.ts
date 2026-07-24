import type {
  ClientUserInviteStatus,
  ClientUserMembership,
  ClientUserRole,
  QuotaSummary,
  ServedClient,
  ServedClientOverview,
  ServedClientStatus,
} from '@gestao-epi/shared';
import { apiFetch } from './auth';

export type ServedClientInput = {
  legalName: string;
  tradeName?: string;
  cnpj: string;
  allocatedLifeQuota: number;
  status?: ServedClientStatus;
  notes?: string;
};

export type ClientUserInput = {
  name: string;
  email: string;
  role: Exclude<ClientUserRole, 'WORKER'>;
};

export function listServedClients() {
  return apiFetch<ServedClient[]>('/served-clients');
}

export function getQuotaSummary() {
  return apiFetch<QuotaSummary>('/served-clients/quota-summary');
}

export function getServedClient(id: string) {
  return apiFetch<ServedClient>(`/served-clients/${id}`);
}

export function getServedClientOverview(id: string) {
  return apiFetch<ServedClientOverview>(`/served-clients/${id}/overview`);
}

export function listClientUsers(clientId: string) {
  return apiFetch<ClientUserMembership[]>(`/served-clients/${clientId}/users`);
}

export function createClientUser(clientId: string, input: ClientUserInput) {
  return apiFetch<ClientUserMembership>(`/served-clients/${clientId}/users`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateClientUser(
  clientId: string,
  membershipId: string,
  input: Partial<ClientUserInput>,
) {
  return apiFetch<ClientUserMembership>(
    `/served-clients/${clientId}/users/${membershipId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  );
}

export function updateClientUserStatus(
  clientId: string,
  membershipId: string,
  isActive: boolean,
) {
  return apiFetch<ClientUserMembership>(
    `/served-clients/${clientId}/users/${membershipId}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    },
  );
}

export function createServedClient(input: ServedClientInput) {
  return apiFetch<ServedClient>('/served-clients', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateServedClient(
  id: string,
  input: Partial<ServedClientInput>,
) {
  return apiFetch<ServedClient>(`/served-clients/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function updateServedClientStatus(
  id: string,
  status: ServedClientStatus,
) {
  return apiFetch<ServedClient>(`/served-clients/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export function clientUserRoleLabel(role: ClientUserRole) {
  if (role === 'CLIENT_MANAGER') return 'Gestor do cliente';
  if (role === 'STOCK_OPERATOR') return 'Operador de estoque';
  return 'Trabalhador (futuro)';
}

export function clientUserInviteLabel(status: ClientUserInviteStatus) {
  if (status === 'LINKED') return 'Login vinculado';
  return 'Preparado (convite/login futuro)';
}
