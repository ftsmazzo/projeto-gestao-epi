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

/** Payload normalizado de uma linha de importacao CSV de EPIs. */
export interface EpiImportVariantDraft {
  size: string | null;
  color: string | null;
  model: string | null;
  side: string | null;
  notes: string | null;
}

export interface EpiImportNormalizedPayload {
  name: string;
  description: string | null;
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
  variant: EpiImportVariantDraft | null;
}

export type EpiImportRowMatchBy = 'externalCode' | 'caNumber';

export type EpiImportRowAction = 'create' | 'update';

export interface EpiImportPreviewRow {
  rowNumber: number;
  /** Linha apta a gravacao (sem erros bloqueantes). */
  ok: boolean;
  errors: string[];
  warnings: string[];
  enrichedFromCaepi: boolean;
  caNotFound: boolean;
  caStatus: CaCertificateStatus | null;
  action: EpiImportRowAction | null;
  matchBy: EpiImportRowMatchBy | null;
  existingEpiId: string | null;
  payload: EpiImportNormalizedPayload | null;
}

export interface EpiImportPreviewTotals {
  rowsRead: number;
  valid: number;
  withErrors: number;
  withWarnings: number;
  enrichedFromCaepi: number;
  caNotFound: number;
  conflicts: number;
}

export interface EpiImportPreviewResponse {
  unknownColumns: string[];
  rows: EpiImportPreviewRow[];
  totals: EpiImportPreviewTotals;
}

export interface EpiImportConfirmRowInput {
  rowNumber: number;
  payload: EpiImportNormalizedPayload;
}

export interface EpiImportConfirmResponse {
  created: number;
  updated: number;
  variantsCreated: number;
  failed: number;
  errors: Array<{ rowNumber: number; message: string }>;
}

export type EpiStockMovementType = 'ENTRADA' | 'SAIDA_MANUAL' | 'AJUSTE';

export type StockBalanceStatus = 'OK' | 'BAIXO' | 'ZERADO';

export interface StockLocation {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EpiStockBalance {
  id: string;
  organizationId: string;
  epiItemId: string;
  epiVariantId: string | null;
  stockLocationId: string;
  quantity: number;
  minQuantity: number | null;
  createdAt: string;
  updatedAt: string;
  status: StockBalanceStatus;
  epiItem?: {
    id: string;
    name: string;
    category: EpiCategory | null;
    caNumber: string | null;
    unitOfMeasure: EpiUnitOfMeasure;
    isActive: boolean;
  };
  epiVariant?: {
    id: string;
    size: string | null;
    color: string | null;
    model: string | null;
    side: string | null;
  } | null;
  stockLocation?: {
    id: string;
    name: string;
    isActive: boolean;
  };
}

export interface EpiStockMovement {
  id: string;
  organizationId: string;
  epiItemId: string;
  epiVariantId: string | null;
  stockLocationId: string;
  type: EpiStockMovementType;
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  reason: string | null;
  notes: string | null;
  createdByUserId: string;
  createdAt: string;
  epiItem?: {
    id: string;
    name: string;
  };
  epiVariant?: {
    id: string;
    size: string | null;
    color: string | null;
    model: string | null;
  } | null;
  stockLocation?: {
    id: string;
    name: string;
  };
  createdByUser?: {
    id: string;
    name: string;
  };
}

export interface StockSummary {
  locationsActive: number;
  locationsTotal: number;
  balanceLines: number;
  totalUnits: number;
  lowStockCount: number;
  zeroStockCount: number;
}

export interface EpiStockTotal {
  epiItemId: string;
  totalQuantity: number;
}

export type EpiNeedStockStatus = 'UNLINKED' | 'WITH_STOCK' | 'NO_STOCK';

export interface EpiNeed {
  id: string;
  organizationId: string;
  name: string;
  category: EpiCategory | null;
  description: string | null;
  aliases: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  linkedItemsCount?: number;
  totalStockQuantity?: number;
  stockStatus?: EpiNeedStockStatus;
}

export interface EpiItemNeedLink {
  id: string;
  organizationId: string;
  epiItemId: string;
  epiNeedId: string;
  isPrimary: boolean;
  notes: string | null;
  createdAt: string;
  stockQuantity?: number;
  epiItem?: {
    id: string;
    name: string;
    caNumber: string | null;
    category: EpiCategory | null;
    isActive: boolean;
    manufacturerName?: string | null;
  };
  epiNeed?: EpiNeed;
}

export interface EpiNeedDetail extends EpiNeed {
  items: EpiItemNeedLink[];
}

export interface EpiNeedDefaultsResult {
  createdCount: number;
  skippedCount: number;
  created: EpiNeed[];
}

export interface EpiNeedMatchResult {
  suggestions: Array<{
    id: string;
    name: string;
    category: EpiCategory | null;
  }>;
  unmatchedNames?: string[];
}

export type OccupationalRiskCategory =
  | 'FISICO'
  | 'QUIMICO'
  | 'BIOLOGICO'
  | 'ERGONOMICO'
  | 'MECANICO'
  | 'ACIDENTE'
  | 'PSICOSSOCIAL'
  | 'OUTROS';

export type RiskLevel =
  | 'MUITO_BAIXO'
  | 'BAIXO'
  | 'MODERADO'
  | 'ALTO'
  | 'MUITO_ALTO';

export interface ClientSector {
  id: string;
  organizationId: string;
  servedClientId: string;
  operationalUnitId: string | null;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  operationalUnit?: {
    id: string;
    name: string;
    status: OperationalUnitStatus;
  } | null;
  _count?: { jobFunctions: number };
}

export interface OccupationalRisk {
  id: string;
  organizationId: string;
  name: string;
  category: OccupationalRiskCategory;
  description: string | null;
  aliases: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface JobFunctionRiskLink {
  id: string;
  organizationId: string;
  jobFunctionId: string;
  riskId: string;
  exposure: string | null;
  source: string | null;
  possibleDamage: string | null;
  riskLevel: RiskLevel | null;
  notes: string | null;
  createdAt: string;
  risk: OccupationalRisk;
}

export interface ClientJobFunction {
  id: string;
  organizationId: string;
  servedClientId: string;
  sectorId: string;
  name: string;
  description: string | null;
  environmentDescription: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  sector?: {
    id: string;
    name: string;
    isActive: boolean;
  };
  risks?: JobFunctionRiskLink[];
  epiRequirements?: JobFunctionEpiRequirement[];
  _count?: { risks: number; epiRequirements?: number };
}

export type EpiRequirementSource = 'MANUAL' | 'PGRO' | 'IMPORT';

export interface JobFunctionEpiRequirement {
  id: string;
  organizationId: string;
  jobFunctionId: string;
  riskId: string | null;
  epiNeedId: string;
  isRequired: boolean;
  quantity: number;
  replacementIntervalDays: number | null;
  notes: string | null;
  source: EpiRequirementSource;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  risk?: OccupationalRisk | null;
  epiNeed?: EpiNeed;
}

export interface OccupationalRiskDefaultsResult {
  createdCount: number;
  skippedCount: number;
  created: OccupationalRisk[];
}

export type PgroImportStatus = 'PENDING' | 'PARSED' | 'CONFIRMED' | 'FAILED';

export interface PgroCompanyData {
  legalName: string | null;
  tradeName: string | null;
  cnpj: string | null;
  addressLine: string | null;
  city: string | null;
  state: string | null;
  cnae: string | null;
  riskGrade: string | null;
  employeeCount: number | null;
  rawText: string | null;
}

export interface PgroExtractedSector {
  tempId: string;
  name: string;
  rawText: string;
  included: boolean;
}

export interface PgroExtractedFunction {
  tempId: string;
  name: string;
  sectorName: string | null;
  activityDescription: string | null;
  environmentDescription: string | null;
  gheName: string | null;
  rawText: string;
  included: boolean;
}

export interface PgroExtractedRisk {
  tempId: string;
  name: string;
  category: OccupationalRiskCategory;
  exposure: string | null;
  source: string | null;
  possibleDamage: string | null;
  riskLevel: string | null;
  functionNames: string[];
  rawText: string;
  included: boolean;
}

export interface PgroExtractedEpiNeed {
  tempId: string;
  extractedText: string;
  suggestedName: string;
  matchedEpiNeedId: string | null;
  matchedEpiNeedName: string | null;
  createNew: boolean;
  functionNames: string[];
  riskNames: string[];
  included: boolean;
}

export interface PgroImportConfirmSummary {
  servedClientId: string;
  createdClient: boolean;
  sectorsCreated: number;
  sectorsExisting: number;
  functionsCreated: number;
  functionsExisting: number;
  risksCreated: number;
  risksExisting: number;
  riskLinksCreated: number;
  epiNeedsCreated: number;
  epiNeedsExisting: number;
  epiRequirementsCreated: number;
  epiRequirementsExisting: number;
}

export interface PgroImportRun {
  id: string;
  organizationId: string;
  servedClientId: string | null;
  status: PgroImportStatus;
  fileName: string;
  startedAt: string;
  finishedAt: string | null;
  company: PgroCompanyData | null;
  sectors: PgroExtractedSector[];
  functions: PgroExtractedFunction[];
  risks: PgroExtractedRisk[];
  epiNeeds: PgroExtractedEpiNeed[];
  warnings: string[];
  confirmSummary?: PgroImportConfirmSummary | null;
  errorMessage: string | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PgroImportConfirmResult extends PgroImportRun {
  summary: PgroImportConfirmSummary;
  confirmWarnings: string[];
}

export interface ConfirmPgroImportPayload {
  servedClientId?: string | null;
  company: {
    legalName?: string | null;
    tradeName?: string | null;
    cnpj?: string | null;
    allocatedLifeQuota?: number;
  };
  sectors: Array<{ tempId: string; name: string; included: boolean }>;
  functions: Array<{
    tempId: string;
    name: string;
    sectorName?: string | null;
    activityDescription?: string | null;
    environmentDescription?: string | null;
    included: boolean;
  }>;
  risks: Array<{
    tempId: string;
    name: string;
    category: OccupationalRiskCategory;
    functionNames?: string[];
    included: boolean;
  }>;
  epiNeeds: Array<{
    tempId: string;
    suggestedName: string;
    matchedEpiNeedId?: string | null;
    createNew: boolean;
    functionNames?: string[];
    riskNames?: string[];
    included: boolean;
  }>;
}


