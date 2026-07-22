import type {
  OperationalUnit,
  OperationalUnitStatus,
} from '@gestao-epi/shared';
import { apiFetch } from './auth';

export type OperationalUnitInput = {
  name: string;
  code?: string | null;
  addressLine?: string | null;
  city?: string | null;
  state?: string | null;
  notes?: string | null;
};

export function listOperationalUnits(servedClientId: string) {
  return apiFetch<OperationalUnit[]>(
    `/served-clients/${servedClientId}/operational-units`,
  );
}

export function getOperationalUnit(id: string) {
  return apiFetch<OperationalUnit>(`/operational-units/${id}`);
}

export function createOperationalUnit(
  servedClientId: string,
  input: OperationalUnitInput,
) {
  return apiFetch<OperationalUnit>(
    `/served-clients/${servedClientId}/operational-units`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export function updateOperationalUnit(
  id: string,
  input: Partial<OperationalUnitInput>,
) {
  return apiFetch<OperationalUnit>(`/operational-units/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function updateOperationalUnitStatus(
  id: string,
  status: OperationalUnitStatus,
) {
  return apiFetch<OperationalUnit>(`/operational-units/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}
