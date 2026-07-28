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
