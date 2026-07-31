import type {
  OrganizationContact,
  OrganizationContactRole,
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
