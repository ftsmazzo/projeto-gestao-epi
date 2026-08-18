import type {
  MembershipRole,
  OrganizationContact,
  OrganizationContactRole,
  OrganizationMember,
  OrganizationMemberAccessResult,
} from '@gestao-epi/shared';
import { apiFetch, getAccessToken, getApiUrl } from './auth';

export type HardResetSummary = {
  servedClients: number;
  workers: number;
  epiItems: number;
  epiNeeds: number;
  stockLocations: number;
  occupationalRisks: number;
  pgroImportRuns: number;
  clientUsers: number;
  auditLogs: number;
  epiDeliveries: number;
  facialReferences: number;
};

export function hardResetOrganization(confirmation: string) {
  return apiFetch<HardResetSummary>('/organization/hard-reset', {
    method: 'POST',
    body: JSON.stringify({ confirmation }),
  });
}

export type OrganizationContactInput = {
  name: string;
  email?: string | null;
  phone?: string | null;
  role?: OrganizationContactRole;
  isPrimary?: boolean;
  isActive?: boolean;
  notes?: string | null;
};

export function listOrganizationContacts() {
  return apiFetch<OrganizationContact[]>('/organization/contacts');
}

export function createOrganizationContact(input: OrganizationContactInput) {
  return apiFetch<OrganizationContact>('/organization/contacts', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateOrganizationContact(
  id: string,
  input: Partial<OrganizationContactInput>,
) {
  return apiFetch<OrganizationContact>(`/organization/contacts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteOrganizationContact(id: string) {
  return apiFetch<{ ok: true }>(`/organization/contacts/${id}`, {
    method: 'DELETE',
  });
}

export function organizationContactRoleLabel(role: OrganizationContactRole) {
  if (role === 'SUPPORT') return 'Suporte';
  if (role === 'COMMERCIAL') return 'Comercial';
  if (role === 'BILLING') return 'Cobranca';
  return 'Operacao';
}

export function listOrganizationMembers() {
  return apiFetch<OrganizationMember[]>('/organization/members');
}

export function createOrganizationMember(input: {
  name: string;
  email: string;
  phone?: string;
  role: Exclude<MembershipRole, 'OWNER'>;
}) {
  return apiFetch<OrganizationMemberAccessResult>('/organization/members', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateOrganizationMember(
  membershipId: string,
  input: { phone?: string | null },
) {
  return apiFetch<OrganizationMember>(`/organization/members/${membershipId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function updateOrganizationMemberRole(
  membershipId: string,
  role: Exclude<MembershipRole, 'OWNER'>,
) {
  return apiFetch<OrganizationMember>(
    `/organization/members/${membershipId}/role`,
    {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    },
  );
}

export function transferOrganizationOwnership(membershipId: string) {
  return apiFetch<OrganizationMember[]>(
    '/organization/members/transfer-ownership',
    {
      method: 'POST',
      body: JSON.stringify({ membershipId }),
    },
  );
}

export function resetOrganizationMemberPassword(membershipId: string) {
  return apiFetch<OrganizationMemberAccessResult>(
    `/organization/members/${membershipId}/reset-password`,
    { method: 'POST' },
  );
}

export function removeOrganizationMember(membershipId: string) {
  return apiFetch<{ ok: true }>(`/organization/members/${membershipId}`, {
    method: 'DELETE',
  });
}

export function getOrganizationBranding() {
  return apiFetch<{ name: string; hasLogo: boolean }>('/organization/branding');
}

export async function uploadOrganizationLogo(file: File) {
  const token = getAccessToken();
  const body = new FormData();
  body.append('file', file);
  const response = await fetch(`${getApiUrl()}/organization/logo`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body,
  });
  if (!response.ok) {
    let message = `Erro HTTP ${response.status}`;
    try {
      const payload = (await response.json()) as { message?: string | string[] };
      if (Array.isArray(payload.message)) message = payload.message.join(', ');
      else if (payload.message) message = payload.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  return (await response.json()) as { hasLogo: boolean };
}

export function deleteOrganizationLogo() {
  return apiFetch<{ hasLogo: boolean }>('/organization/logo', {
    method: 'DELETE',
  });
}

export async function fetchOrganizationLogoObjectUrl() {
  const token = getAccessToken();
  const response = await fetch(`${getApiUrl()}/organization/logo`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!response.ok) return null;
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

export function membershipRoleLabel(role: MembershipRole) {
  if (role === 'OWNER') return 'Administrador geral';
  if (role === 'ADMIN') return 'Administrador';
  return 'Membro';
}

export function formatTeamAccessCopy(access: OrganizationMemberAccessResult) {
  const lines = [
    `Link: ${access.accessUrl}`,
    `E-mail: ${access.member.user.email}`,
    `Papel: ${membershipRoleLabel(access.member.role)}`,
  ];
  if (access.temporaryPassword) {
    lines.splice(2, 0, `Senha temporaria: ${access.temporaryPassword}`);
  } else {
    lines.push('Senha: enviada por e-mail/WhatsApp (nao exibida na tela).');
  }
  return lines.join('\n');
}
