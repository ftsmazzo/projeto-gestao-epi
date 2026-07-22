export const APP_NAME = 'Gestao Digital de Entrega de EPI';

export const API_DEFAULT_PORT = 3001;

export type HealthStatus = 'ok' | 'degraded' | 'down';

export interface HealthResponse {
  status: HealthStatus;
  service: string;
  timestamp: string;
}

export type MembershipRole = 'OWNER' | 'ADMIN' | 'MEMBER';

export interface AuthOrganization {
  id: string;
  name: string;
  slug: string;
  contractedLifeQuota: number;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  membershipRole: MembershipRole;
  organization: AuthOrganization;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

export type ServedClientStatus = 'ACTIVE' | 'INACTIVE';

export interface ServedClient {
  id: string;
  organizationId: string;
  legalName: string;
  tradeName: string | null;
  cnpj: string;
  status: ServedClientStatus;
  allocatedLifeQuota: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface QuotaSummary {
  contracted: number;
  allocated: number;
  available: number;
  used: number;
  activeClients: number;
  totalClients: number;
}

export type OperationalUnitStatus = 'ACTIVE' | 'INACTIVE';

export interface OperationalUnit {
  id: string;
  organizationId: string;
  servedClientId: string;
  name: string;
  code: string | null;
  cnpj: string | null;
  status: OperationalUnitStatus;
  addressLine: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export type WorkerStatus = 'ACTIVE' | 'INACTIVE';

export interface Worker {
  id: string;
  organizationId: string;
  servedClientId: string;
  operationalUnitId: string | null;
  name: string;
  cpf: string | null;
  registration: string | null;
  role: string | null;
  department: string | null;
  status: WorkerStatus;
  admissionDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClientLifeSummary {
  allocated: number;
  used: number;
  available: number;
  activeWorkers: number;
  totalWorkers: number;
}

export type EpiItemStatus = 'ACTIVE' | 'INACTIVE';

export interface EpiItem {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  caNumber: string | null;
  caExpirationDate: string | null;
  category: string | null;
  manufacturer: string | null;
  defaultValidityDays: number | null;
  requiresCa: boolean;
  status: EpiItemStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}
