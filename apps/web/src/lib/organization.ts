import type {
  MembershipRole,
  OrganizationContact,
  OrganizationContactRole,
  OrganizationMember,
  OrganizationMemberAccessResult,
} from '@gestao-epi/shared';
import { apiFetch } from './auth';

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
