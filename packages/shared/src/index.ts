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
  /** Franquia total contratada pelo tenant. */
  contracted: number;
  /** Soma das cotas das empresas/clientes ativos (consomem a franquia). */
  allocated: number;
  /** Contratadas menos alocadas em ativos. */
  available: number;
  /** Trabalhadores ativos em clientes ativos. */
  used: number;
  /** Soma das cotas de clientes inativos (liberadas da franquia). */
  inactiveAllocated: number;
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

export type EpiUnitOfMeasure = 'UNIDADE' | 'PAR' | 'CAIXA' | 'KIT';

export type EpiUsefulLifeUnit = 'DIAS' | 'MESES' | 'ANOS';

export type EpiCategory =
  | 'AUDITIVA'
  | 'RESPIRATORIA'
  | 'QUEDA'
  | 'MAOS'
  | 'OLHOS'
  | 'CABECA'
  | 'PES'
  | 'TRONCO'
  | 'OUTROS';

export interface EpiVariant {
  id: string;
  organizationId: string;
  epiItemId: string;
  size: string | null;
  color: string | null;
  model: string | null;
  side: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EpiItem {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  requiresCa: boolean;
  caNumber: string | null;
  caExpiresAt: string | null;
  unitOfMeasure: EpiUnitOfMeasure;
  usefulLifeValue: number | null;
  usefulLifeUnit: EpiUsefulLifeUnit | null;
  category: EpiCategory | null;
  externalCode: string | null;
  manufacturerName: string | null;
  reference: string | null;
  color: string | null;
  approvedFor: string | null;
  restriction: string | null;
  technicalNotes: string | null;
  nrr: number | null;
  nrrsf: number | null;
  variants: EpiVariant[];
  createdAt: string;
  updatedAt: string;
}

export type CaCertificateStatus =
  | 'VALIDO'
  | 'VENCIDO'
  | 'CANCELADO'
  | 'SUSPENSO'
  | 'DESCONHECIDO';

export type CaCertificateSource = 'CAEPI_OFICIAL';

export interface CaCertificateNorm {
  id: string;
  certificateId: string;
  laboratoryCnpj: string | null;
  laboratoryName: string | null;
  reportNumber: string | null;
  standard: string | null;
  createdAt: string;
}

export interface CaCertificate {
  id: string;
  caNumber: string;
  expiresAt: string | null;
  status: CaCertificateStatus;
  processNumber: string | null;
  manufacturerCnpj: string | null;
  manufacturerName: string | null;
  nature: string | null;
  equipmentName: string | null;
  equipmentDescription: string | null;
  brand: string | null;
  reference: string | null;
  color: string | null;
  approvedFor: string | null;
  restriction: string | null;
  analysisNotes: string | null;
  source: CaCertificateSource;
  sourceImportedAt: string | null;
  createdAt: string;
  updatedAt: string;
  norms: CaCertificateNorm[];
}

export interface CaCertificateLookupResponse {
  found: boolean;
  certificate: CaCertificate | null;
  message: string | null;
  /** Total de certificados na base local no momento da consulta. */
  baseCertificateCount?: number;
  /** Indica base vazia ou provavelmente incompleta (amostra pequena). */
  baseIncomplete?: boolean;
}

export interface CaCertificateSearchItem {
  caNumber: string;
  status: CaCertificateStatus;
  expiresAt: string | null;
  equipmentName: string | null;
  manufacturerName: string | null;
  reference: string | null;
  color: string | null;
  sourceImportedAt: string | null;
}

export interface CaCertificateSearchResponse {
  query: string;
  items: CaCertificateSearchItem[];
  baseCertificateCount: number;
  baseIncomplete: boolean;
  message: string | null;
}

export interface CaepiImportResult {
  /** Nome do arquivo enviado na importacao. */
  fileName: string | null;
  /** Aba XLSX lida, quando aplicavel. */
  sheetName: string | null;
  rowsRead: number;
  certificatesCreated: number;
  certificatesUpdated: number;
  normsCreated: number;
  rowsSkipped: number;
  /** Total de certificados no banco apos a importacao. */
  certificatesTotalAfter: number;
  /** Total de normas/laudos no banco apos a importacao. */
  normsTotalAfter: number;
  errors: Array<{ row: number; message: string }>;
  startedAt: string;
  finishedAt: string;
}

export type CaepiImportRunStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'SUCCESS'
  | 'FAILED';

export type CaepiImportTriggeredBy = 'MANUAL' | 'SCHEDULED' | 'UPLOAD';

export interface CaepiImportRun {
  id: string;
  status: CaepiImportRunStatus;
  triggeredBy: CaepiImportTriggeredBy;
  sourceUrl: string | null;
  fileName: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  rowsRead: number | null;
  certificatesCreated: number | null;
  certificatesUpdated: number | null;
  normsCreated: number | null;
  rowsSkipped: number | null;
  certificatesTotalAfter: number | null;
  normsTotalAfter: number | null;
  errorMessage: string | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CaepiStatusResponse {
  certificatesTotal: number;
  normsTotal: number;
  baseIncomplete: boolean;
  incompleteThreshold: number;
  /** @deprecated Use sourceOverrideConfigured. Indica override tecnico. */
  sourceUrlConfigured: boolean;
  sourceOverrideConfigured: boolean;
  usesOfficialDefaults: boolean;
  sourceUrl: string | null;
  autoSyncEnabled: boolean;
  syncCron: string;
  lastImport: CaepiImportRun | null;
  activeRun: CaepiImportRun | null;
  operationalMessage: string | null;
}

export interface CaepiSyncStartResponse {
  runId: string;
  status: CaepiImportRunStatus;
}
