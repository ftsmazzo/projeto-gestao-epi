import type {
  ClientInitialAccess,
  ClientUserAccessStatus,
  ClientUserMembership,
  ClientUserRole,
  CreateServedClientResult,
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
  contactEmail?: string;
  contactPhone?: string;
  notes?: string;
  sstDocumentsEnabled?: boolean;
  initialManagerName?: string;
  initialManagerEmail?: string;
  initialManagerPhone?: string;
};

export type ClientUserInput = {
  name: string;
  email: string;
  role: Exclude<ClientUserRole, 'WORKER'>;
  phone?: string | null;
};

export type InitialManagerInput = {
  name: string;
  email: string;
  phone?: string;
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

export function createInitialManager(
  clientId: string,
  input: InitialManagerInput,
) {
  return apiFetch<ClientInitialAccess>(
    `/served-clients/${clientId}/initial-manager`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export function resetClientUserAccess(clientId: string, membershipId: string) {
  return apiFetch<ClientInitialAccess>(
    `/served-clients/${clientId}/users/${membershipId}/reset-access`,
    {
      method: 'POST',
    },
  );
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
  return apiFetch<CreateServedClientResult>('/served-clients', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export type ServedClientUpdateInput = {
  legalName?: string;
  tradeName?: string | null;
  cnpj?: string;
  allocatedLifeQuota?: number;
  status?: ServedClientStatus;
  contactEmail?: string | null;
  contactPhone?: string | null;
  notes?: string | null;
  sstDocumentsEnabled?: boolean;
};

export function updateServedClient(id: string, input: ServedClientUpdateInput) {
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

export function clientUserAccessLabel(status: ClientUserAccessStatus) {
  if (status === 'ACTIVE') return 'ACTIVE';
  if (status === 'INVITED') return 'INVITED';
  if (status === 'DISABLED') return 'DISABLED';
  return 'PREPARED';
}

export function formatAccessCredentialsCopy(access: ClientInitialAccess) {
  const lines = [
    `Portal do cliente: ${access.accessUrl}`,
    `Usuario/e-mail: ${access.managerEmail}`,
  ];
  if (access.managerPhone) {
    lines.push(`WhatsApp: ${access.managerPhone}`);
  }
  if (access.temporaryPassword) {
    lines.push(`Senha temporaria: ${access.temporaryPassword}`);
  } else {
    lines.push('Senha: mantida (gestor ja tinha cadastro).');
  }
  lines.push(
    '',
    access.reusedExistingUser || !access.temporaryPassword
      ? 'Nao geramos nova senha. O gestor entra com a senha atual e troca de empresa no portal.'
      : 'Copie estes dados agora. A senha temporaria nao sera exibida novamente.',
    'ATENCAO: use apenas o portal do cliente. Nao use o login da Consultoria.',
  );
  if (access.delivery) {
    lines.push(
      '',
      `Envio e-mail: ${access.delivery.email}`,
      `Envio WhatsApp: ${access.delivery.whatsapp}`,
    );
  }
  return lines.join('\n');
}
