export const APP_NAME = 'ProntEPI';
export const APP_TAGLINE = 'EPI sob controle. Entrega sem falha.';
export const APP_PITCH =
  'Da implantacao ao comprovante facial — conformidade NR-06 no ritmo da operacao.';

export const API_DEFAULT_PORT = 3001;

export * from './face-biometrics';

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
  contactEmail: string | null;
  contactPhone: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export type OrganizationContactRole =
  | 'SUPPORT'
  | 'COMMERCIAL'
  | 'BILLING'
  | 'OPERATIONS';

export interface OrganizationContact {
  id: string;
  organizationId: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: OrganizationContactRole;
  isPrimary: boolean;
  isActive: boolean;
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
  clientSectorId: string | null;
  clientJobFunctionId: string | null;
  name: string;
  cpf: string | null;
  registration: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  department: string | null;
  status: WorkerStatus;
  admissionDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Item enriquecido para listagem na Consultoria (estrutura + EPIs herdados). */
export interface WorkerListItem extends Worker {
  unitName: string | null;
  sectorName: string | null;
  jobFunctionName: string | null;
  requiredEpiCount: number;
  requiredEpiNeeds: Array<{ id: string; name: string }>;
  /**
   * Biometria operacionalmente valida (ACTIVE + template).
   * Foto de referencia ausente no disco nao invalida o matching.
   */
  hasValidBiometrics: boolean;
  /** Arquivo de foto de referencia presente no storage. */
  hasFaceImage: boolean;
  biometricStatus:
    | 'OK'
    | 'OK_MISSING_IMAGE'
    | 'NEEDS_REENROLLMENT'
    | 'REVOKED'
    | 'MISSING'
    | 'INCOMPLETE';
}

export type WorkerImportRowAction = 'create' | 'update';
export type WorkerImportMatchBy = 'cpf' | 'registration';

export interface WorkerImportNormalizedPayload {
  name: string;
  cpf: string | null;
  registration: string | null;
  email: string | null;
  phone: string | null;
  admissionDate: string | null;
  status: WorkerStatus;
  operationalUnitId: string | null;
  clientSectorId: string | null;
  clientJobFunctionId: string | null;
  /** Espelho textual do setor (compat / exibicao). */
  department: string | null;
  /** Espelho textual da funcao (compat / exibicao). */
  role: string | null;
}

export interface WorkerImportPreviewRow {
  rowNumber: number;
  status: 'valid' | 'error';
  action: WorkerImportRowAction | null;
  matchBy: WorkerImportMatchBy | null;
  existingWorkerId: string | null;
  exceedsQuota: boolean;
  errors: string[];
  warnings: string[];
  raw: Record<string, string>;
  payload: WorkerImportNormalizedPayload | null;
  resolved: {
    unitName: string | null;
    sectorName: string | null;
    jobFunctionName: string | null;
    requiredEpiCount: number;
  };
}

export interface WorkerImportPreviewResponse {
  warnings: string[];
  totals: {
    rowsRead: number;
    valid: number;
    withErrors: number;
    creates: number;
    updates: number;
    exceedQuota: number;
  };
  lifeImpact: {
    allocated: number;
    currentlyUsed: number;
    availableBefore: number;
    activeDelta: number;
    availableAfter: number;
  };
  rows: WorkerImportPreviewRow[];
}

export interface WorkerImportConfirmRowInput {
  rowNumber: number;
  payload: WorkerImportNormalizedPayload;
}

export interface WorkerImportConfirmResponse {
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ rowNumber: number; message: string }>;
  lifeSummary: ClientLifeSummary;
}

export interface ClientLifeSummary {
  allocated: number;
  used: number;
  available: number;
  activeWorkers: number;
  totalWorkers: number;
}

export type ClientUserRole =
  | 'CLIENT_MANAGER'
  | 'STOCK_OPERATOR'
  | 'WORKER';

export type ClientUserAccessStatus =
  | 'PREPARED'
  | 'INVITED'
  | 'ACTIVE'
  | 'DISABLED';

export interface ClientPortalClient {
  id: string;
  legalName: string;
  tradeName: string | null;
  cnpj: string;
  status: ServedClientStatus;
}

export interface ClientPortalUser {
  id: string;
  email: string;
  name: string;
  role: ClientUserRole;
  mustChangePassword: boolean;
  accessStatus: ClientUserAccessStatus;
  organization: {
    id: string;
    name: string;
  };
  servedClient: ClientPortalClient;
}

export interface ClientAuthResponse {
  accessToken: string;
  user: ClientPortalUser;
}

export interface ClientUserMembership {
  id: string;
  organizationId: string;
  servedClientId: string;
  userId: string | null;
  email: string;
  name: string;
  phone: string | null;
  role: ClientUserRole;
  isActive: boolean;
  accessStatus: ClientUserAccessStatus;
  mustChangePassword: boolean;
  temporaryPasswordCreatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type AccessInviteDeliveryStatus =
  | 'SENT'
  | 'FAILED'
  | 'PENDING'
  | 'SKIPPED'
  | 'NOT_REQUESTED';

export interface ClientInitialAccess {
  membershipId: string;
  managerName: string;
  managerEmail: string;
  managerPhone: string | null;
  temporaryPassword: string;
  accessUrl: string;
  accessStatus: ClientUserAccessStatus;
  warning: string;
  /** Resultado do disparo imediato de convite (e-mail/WhatsApp). */
  delivery?: {
    enabled: boolean;
    email: AccessInviteDeliveryStatus;
    whatsapp: AccessInviteDeliveryStatus;
    emailError?: string | null;
    whatsappError?: string | null;
    whatsappDetail?: string | null;
  };
}

export interface CreateServedClientResult {
  client: ServedClient;
  initialAccess: ClientInitialAccess | null;
}

/** Resposta de POST /communications/alerts/daily/run */
export type DailyAlertsSkipReason =
  | 'communications_disabled'
  | 'alerts_disabled'
  | 'client_not_found'
  | 'no_alerts'
  | 'no_recipients'
  | 'already_sent_today';

export interface RunDailyAlertsResult {
  clients: number;
  messages: number;
  skippedReason?: DailyAlertsSkipReason;
}

export interface ServedClientOverview {
  client: ServedClient;
  operational: boolean;
  lives: {
    allocated: number;
    used: number;
    available: number;
    note: string;
  };
  counts: {
    units: { active: number; total: number };
    workers: { active: number; total: number };
    sectors: { active: number; total: number };
    jobFunctions: { active: number; total: number };
    riskLinks: number;
    epiRequirements: number;
    epiNeeds: {
      active: number;
      scopedToClient: boolean;
      note: string;
    };
    epiItems: {
      active: number;
      scopedToClient: boolean;
      note: string;
    };
    stock: {
      balanceRows: number;
      totalQuantity: number;
      low: number;
      zero: number;
      scopedToClient: boolean;
      note: string;
    };
    users: {
      managers: { active: number; total: number; limit: number };
      stockOperators: { active: number; total: number; limit: number };
    };
  };
  lastPgroImport: {
    id: string;
    fileName: string;
    status: string;
    createdAt: string;
    finishedAt: string | null;
    createdByEmail: string | null;
    createdByName: string | null;
  } | null;
}

export const CLIENT_MANAGER_LIMIT = 2;
export const STOCK_OPERATOR_LIMIT = 4;

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
  servedClientId: string | null;
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
  confidence?: 'high' | 'low';
  source?: 'GHE' | 'KEYWORD' | 'GLOBAL';
  gheName?: string | null;
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
  confidence?: 'high' | 'low';
  source?: 'GHE' | 'KEYWORD' | 'GLOBAL';
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
  confidence?: 'high' | 'low';
  extractionSource?: 'GHE' | 'KEYWORD' | 'GLOBAL';
  gheName?: string | null;
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
  confidence?: 'high' | 'low';
  extractionSource?: 'GHE' | 'KEYWORD' | 'GLOBAL';
  gheName?: string | null;
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
  /** Presente quando o confirm criou/provisionou o gestor do portal. */
  initialAccess?: ClientInitialAccess | null;
}

export interface ConfirmPgroImportPayload {
  servedClientId?: string | null;
  company: {
    legalName?: string | null;
    tradeName?: string | null;
    cnpj?: string | null;
    allocatedLifeQuota?: number;
    contactEmail?: string | null;
    contactPhone?: string | null;
  };
  /** Gestor do portal: recebe link e senha por e-mail/WhatsApp. */
  initialManager?: {
    name: string;
    email: string;
    phone?: string | null;
  } | null;
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

/** Respostas do Painel do Cliente (`/portal/*`, JWT audience client). */
export type PortalValidityBucket = 'expired' | 'soon' | 'ok' | 'missing';

export type PortalAttentionTone = 'ok' | 'info' | 'warn' | 'critical';

export interface PortalAttentionCard {
  id:
    | 'replacement'
    | 'caValidity'
    | 'stock'
    | 'deliveries'
    | 'biometrics';
  title: string;
  href: string;
  count: number;
  tone: PortalAttentionTone;
  label: string;
  detail: string;
  visible: boolean;
}

export interface PortalDashboardResponse {
  client: {
    id: string;
    legalName: string;
    tradeName: string | null;
    cnpj: string;
    status: ServedClientStatus;
    allocatedLifeQuota: number;
  };
  lives: {
    allocated: number;
    used: number;
    available: number;
  };
  counts: {
    unitsActive: number;
    workersActive: number;
    sectorsActive: number;
    jobsActive: number;
    requirementsActive: number;
    uniqueNeeds: number;
  };
  metrics: {
    entregas: number | null;
    validade: number;
    custos: number | null;
    estoque: number;
  };
  validitySummary: {
    expired: number;
    soon: number;
    missingCa: number;
    tracked: number;
  };
  attention: {
    replacement: {
      overdue: number;
      critical: number;
      warn: number;
      total: number;
      warnDays: number;
      criticalDays: number;
    };
    caValidity: {
      expired: number;
      soon: number;
      missingCa: number;
      total: number;
    };
    stock: {
      low: number;
      zero: number;
      total: number;
    };
    deliveries: {
      last7Days: number;
    };
    biometrics: {
      missing: number;
      workersActive: number;
    };
    cards: PortalAttentionCard[];
  };
  modules: {
    entregas: { ready: boolean; reason?: string };
    validade: { ready: boolean; reason?: string };
    custos: { ready: boolean; reason?: string };
    estoque: { ready: boolean; mode?: 'needs' | 'stock'; reason?: string };
  };
}

export interface PortalValidityItem {
  epiItemId: string;
  epiName: string;
  caNumber: string | null;
  caExpiresAt: string | null;
  requiresCa: boolean;
  bucket: PortalValidityBucket;
  daysRemaining: number | null;
  needNames: string[];
  jobNames: string[];
}

export interface PortalValidadeResponse {
  summary: {
    expired: number;
    soon: number;
    ok: number;
    missing: number;
    total: number;
    horizonDays: number;
  };
  items: PortalValidityItem[];
}

export interface PortalEstruturaResponse {
  units: Array<{
    id: string;
    name: string;
    code: string | null;
  }>;
  sectors: Array<{
    id: string;
    name: string;
    unitName: string | null;
    operationalUnitId: string | null;
    jobs: Array<{
      id: string;
      name: string;
      risks: string[];
      needs: Array<{
        id: string;
        name: string;
        riskNames: string[];
      }>;
    }>;
  }>;
}

export interface PortalTrabalhadorReplacementItem {
  id: string;
  deliveryId: string;
  receiptNumber: string;
  epiName: string;
  needName: string;
  caNumber: string | null;
  nextReplacementAt: string;
  usefulLifeLabel: string | null;
  daysRemaining: number;
  tone: 'warn' | 'critical';
}

export interface PortalTrabalhadorReplacementDue {
  count: number;
  overdue: number;
  critical: number;
  warn: number;
  tone: 'warn' | 'critical';
  items: PortalTrabalhadorReplacementItem[];
}

export interface PortalTrabalhadoresResponse {
  lives: {
    allocated: number;
    used: number;
    available: number;
  };
  replacementHorizon: {
    warnDays: number;
    criticalDays: number;
  };
  summary: {
    withReplacementDue: number;
  };
  workers: Array<{
    id: string;
    name: string;
    cpf: string | null;
    registration: string | null;
    email: string | null;
    phone: string | null;
    role: string | null;
    department: string | null;
    status: 'ACTIVE' | 'INACTIVE';
    notes: string | null;
    operationalUnitId: string | null;
    clientSectorId: string | null;
    clientJobFunctionId: string | null;
    unitName: string | null;
    sectorName: string | null;
    jobFunctionName: string | null;
    admissionDate: string | null;
    replacementDue: PortalTrabalhadorReplacementDue | null;
  }>;
}

export interface PortalEstoqueResponse {
  mode: 'stock';
  note: string;
  location: {
    id: string;
    name: string;
  };
  summary: {
    needs: number;
    withLinkedEpi: number;
    withoutLinkedEpi: number;
    balanceLines: number;
    totalUnits: number;
  };
  balances: PortalStockBalanceRow[];
  needs: Array<{
    needId: string;
    needName: string;
    jobNames: string[];
    suggestedQuantity: number;
    hasLinkedEpi: boolean;
    hasCatalogSuggestions: boolean;
    items: Array<{
      id: string;
      name: string;
      caNumber: string | null;
      caExpiresAt: string | null;
      usefulLifeValue: number | null;
      usefulLifeUnit: EpiUsefulLifeUnit | null;
      usefulLifeLabel: string | null;
    }>;
    suggestedItems: Array<{
      id: string;
      name: string;
      caNumber: string | null;
      caExpiresAt: string | null;
      usefulLifeValue: number | null;
      usefulLifeUnit: EpiUsefulLifeUnit | null;
      usefulLifeLabel: string | null;
    }>;
  }>;
}

export interface PortalStockBalanceRow {
  id: string;
  epiItemId: string;
  stockLocationId: string;
  quantity: number;
  minQuantity: number | null;
  locationName: string;
  epiName: string;
  caNumber: string | null;
  caExpiresAt: string | null;
  usefulLifeValue: number | null;
  usefulLifeUnit: EpiUsefulLifeUnit | null;
  usefulLifeLabel: string | null;
  unitOfMeasure: EpiUnitOfMeasure;
  category: EpiCategory | null;
}

export interface PortalEpiSearchItem {
  id: string;
  name: string;
  caNumber: string | null;
  caExpiresAt: string | null;
  usefulLifeValue: number | null;
  usefulLifeUnit: EpiUsefulLifeUnit | null;
  usefulLifeLabel: string | null;
  unitOfMeasure: EpiUnitOfMeasure;
  category: EpiCategory | null;
  /** Quando a busca achou uma necessidade do PGRO/estrutura. */
  epiNeedId?: string;
  needName?: string;
  /** Precisa informar CA para criar/vincular o EPI real. */
  requiresCa?: boolean;
}

export interface PortalEpiByCaResponse {
  found: boolean;
  item: PortalEpiSearchItem | null;
  items?: PortalEpiSearchItem[];
  message: string | null;
}

export interface PortalStockEntradasResult {
  locationId: string;
  created: number;
  items: Array<{
    epiItemId: string;
    epiNeedId: string | null;
    quantity: number;
    newQuantity: number;
    movementId: string;
    createdEpiItem: boolean;
  }>;
}

/** Status operacional de cobertura para preparacao de entrega. */
export type PortalEpiCoverageStatus =
  | 'DISPONIVEL'
  | 'SEM_ESTOQUE'
  | 'SEM_EPI_REAL_VINCULADO'
  | 'SEM_REQUISITO';

export interface PortalEntregaWorkerOption {
  id: string;
  name: string;
  registration: string | null;
  /** CPF mascarado para busca/exibicao (nunca completo). */
  cpfMasked: string | null;
  unitId: string | null;
  unitName: string | null;
  sectorId: string | null;
  sectorName: string | null;
  jobFunctionId: string | null;
  jobFunctionName: string | null;
  hasJobFunction: boolean;
  requiredEpiCount: number;
}

export interface PortalEntregasPreparacaoResponse {
  workers: PortalEntregaWorkerOption[];
  filters: {
    units: Array<{ id: string; name: string }>;
    sectors: Array<{ id: string; name: string }>;
    jobs: Array<{ id: string; name: string; sectorId: string }>;
  };
  summary: {
    activeWorkers: number;
    withJobFunction: number;
    withoutJobFunction: number;
  };
}

export interface PortalEpiCoverageLinkedItem {
  epiItemId: string;
  name: string;
  caNumber: string | null;
  caExpiresAt: string | null;
  usefulLifeValue: number | null;
  usefulLifeUnit: EpiUsefulLifeUnit | null;
  usefulLifeLabel: string | null;
  totalQuantity: number;
  balances: Array<{
    stockLocationId: string;
    locationName: string;
    quantity: number;
  }>;
}

export interface PortalEpiCoverageNeedRow {
  requirementId: string;
  /** Todos os JobFunctionEpiRequirement ids agrupados nesta necessidade. */
  requirementIds: string[];
  epiNeedId: string;
  needName: string;
  /** Alias de needName. */
  epiNeedName: string;
  /** @deprecated use risks */
  riskId: string | null;
  /** @deprecated use risks — nomes concatenados para compat */
  riskName: string | null;
  risks: Array<{ id: string; name: string }>;
  isRequired: boolean;
  quantity: number;
  replacementIntervalDays: number | null;
  replacementLabel: string | null;
  status: PortalEpiCoverageStatus;
  guidance: string | null;
  /** Avisos de criterio restritivo (qtd/periodicidade conflitantes). */
  warnings: string[];
  /** Soma dos saldos dos EPIs reais vinculados no cliente. */
  availableStock: number;
  linkedEpis: PortalEpiCoverageLinkedItem[];
  suggestedEpiItemId: string | null;
}

/** Consentimento LGPD biométrico do trabalhador (09.2). */
export type WorkerBiometricConsentStatus =
  | 'GRANTED'
  | 'REVOKED'
  | 'NOT_REGISTERED';

export interface PortalEpiCoverageResponse {
  worker: {
    id: string;
    name: string;
    registration: string | null;
    cpfMasked: string | null;
    unitId: string | null;
    unitName: string | null;
    sectorId: string | null;
    sectorName: string | null;
    jobFunctionId: string | null;
    jobFunctionName: string | null;
  };
  workerHasFacialReference: boolean;
  /** Template biometrico ACTIVE com descritor — exigido para entrega. */
  workerHasBiometricTemplate: boolean;
  /** Consentimento LGPD biometrico (GRANTED | REVOKED | NOT_REGISTERED). */
  biometricConsentStatus: WorkerBiometricConsentStatus;
  facialReference: {
    hasActive: boolean;
    hasDescriptor: boolean;
    needsReenrollment: boolean;
    uploadedAt: string | null;
  };
  summary: {
    totalNeeds: number;
    disponivel: number;
    semEstoque: number;
    semEpiReal: number;
    status: PortalEpiCoverageStatus | 'OK' | 'ATENCAO' | 'BLOQUEADO';
    message: string | null;
  };
  needs: PortalEpiCoverageNeedRow[];
}

export type PortalDeliveryStatus =
  | 'COMPLETED'
  | 'CANCELLED'
  | 'PARTIALLY_RETURNED'
  | 'RETURNED';

export type PortalDeliveryItemStatus =
  | 'DELIVERED'
  | 'CANCELLED'
  | 'RETURNED'
  | 'PARTIALLY_RETURNED';

export type PortalDeliveryReturnCondition =
  | 'REUSABLE'
  | 'DAMAGED'
  | 'DISCARDED'
  | 'LOST';

export type PortalDeliveryEvidenceVerificationStatus =
  | 'CAPTURED'
  | 'HUMAN_CONFIRMED'
  | 'MATCHED'
  | 'REJECTED'
  | 'NO_FACE_DETECTED'
  | 'MULTIPLE_FACES_DETECTED'
  | 'NOT_VERIFIED';

export type PortalDeliveryEvidenceStatusLabel =
  | 'FACIAL_CAPTURED'
  | 'HUMAN_CONFIRMED'
  | 'MATCHED'
  | 'REJECTED'
  | 'NO_FACE_DETECTED'
  | 'MULTIPLE_FACES_DETECTED'
  | 'NOT_VERIFIED';

export const FACIAL_EVIDENCE_CONSENT_VERSION = 'v1-2026-07';

export const FACIAL_EVIDENCE_CONSENT_TEXT =
  'Declaro que a imagem facial será registrada como evidência da entrega deste EPI e vinculada ao comprovante de fornecimento.';

/** Declaracao / termo de responsabilidade do recibo de entrega (placeholder; trocavel). */
export const EPI_DELIVERY_DECLARATION_VERSION = 'v1-2026-07-declaracao';

export const EPI_DELIVERY_DECLARATION_TEXT =
  'Declaro ter recebido os Equipamentos de Protecao Individual relacionados neste comprovante, em perfeitas condicoes de uso, e comprometo-me a utiliza-los corretamente, guarda-los e conserva-los, bem como a comunicar imediatamente qualquer dano, extravio ou alteracao que os torne improprios para uso, conforme a NR-06.';

/** Termo consolidado da ficha individual de EPI (placeholder; trocavel). */
export const EPI_SHEET_DECLARATION_VERSION = 'v1-2026-07-ficha';

export const EPI_SHEET_DECLARATION_TEXT =
  'Esta ficha consolida o historico de fornecimento de EPI ao trabalhador. Declaro ciência das entregas registradas e das responsabilidades de uso, guarda e conservacao dos equipamentos, nos termos da NR-06.';

export const WORKER_FACE_REFERENCE_CONSENT_VERSION = 'v1-2026-07';

export const WORKER_FACE_REFERENCE_CONSENT_TEXT =
  'Esta imagem sera usada como biometria facial de referencia do trabalhador para validacao automatica na entrega de EPI.';

/** Consentimento LGPD biométrico do trabalhador (09.2). */
export const WORKER_BIOMETRIC_CONSENT_VERSION = 'v1-2026-07-lgpd';

export const WORKER_BIOMETRIC_CONSENT_TEXT =
  'Autorizo o uso da biometria facial deste trabalhador para validacao de entregas de EPI e registro de evidencias.';

export type WorkerBiometricDeletionStatus =
  | 'NONE'
  | 'PENDING'
  | 'DELETED'
  | 'FAILED';

export interface BiometricRetentionPendingReference {
  id: string;
  kind: 'FACIAL_REFERENCE';
  workerId: string;
  workerName: string;
  servedClientId: string;
  status: 'ACTIVE' | 'REVOKED' | 'NEEDS_REENROLLMENT';
  deletionStatus: WorkerBiometricDeletionStatus;
  retentionUntil: string | null;
  deletedAt: string | null;
  deletionError: string | null;
  uploadedAt: string;
  revokedAt: string | null;
}

export interface BiometricRetentionPendingEvidence {
  id: string;
  kind: 'DELIVERY_EVIDENCE';
  deliveryId: string;
  receiptNumber: string;
  servedClientId: string;
  workerId: string;
  workerName: string;
  deletionStatus: WorkerBiometricDeletionStatus;
  retentionUntil: string | null;
  deletedAt: string | null;
  deletionError: string | null;
  capturedAt: string;
}

export interface BiometricRetentionPendingResponse {
  references: BiometricRetentionPendingReference[];
  evidences: BiometricRetentionPendingEvidence[];
  summary: {
    referencesPending: number;
    referencesFailed: number;
    evidencesPending: number;
    evidencesFailed: number;
  };
}

export interface BiometricRetentionRunResult {
  triggeredBy: 'MANUAL' | 'SCHEDULED';
  referencesProcessed: number;
  evidencesProcessed: number;
  referencesDeleted: number;
  referencesFailed: number;
  evidencesDeleted: number;
  evidencesFailed: number;
}

export interface WorkerBiometricConsentMeta {
  workerId: string;
  workerName?: string;
  status: WorkerBiometricConsentStatus;
  consent: {
    id: string;
    status: 'GRANTED' | 'REVOKED';
    consentVersion: string;
    consentText: string;
    grantedAt: string;
    revokedAt: string | null;
    revocationReason: string | null;
    retentionUntil: string | null;
    deletionStatus: WorkerBiometricDeletionStatus;
  } | null;
  canEnrollBiometrics: boolean;
  canDeliverWithBiometrics: boolean;
  consentTextTemplate: string;
  consentVersionTemplate: string;
}

export type WorkerFacialReferenceStatus =
  | 'ACTIVE'
  | 'REVOKED'
  | 'MISSING'
  | 'NEEDS_REENROLLMENT';

export type WorkerFacialEnrollmentLinkStatus =
  | 'PENDING'
  | 'EXPIRED'
  | 'CONSUMED'
  | 'REVOKED'
  | 'MISSING';

export interface WorkerFacialEnrollmentLinkGenerated {
  id: string;
  workerId: string;
  workerName: string;
  status: 'PENDING';
  url: string;
  expiresAt: string;
  createdAt: string;
  requiresCpfLast4: boolean;
  notice: string;
}

export interface WorkerFacialEnrollmentLinkStatusResponse {
  workerId: string;
  workerName: string;
  hasCpf: boolean;
  status: WorkerFacialEnrollmentLinkStatus;
  link: {
    id: string;
    status: WorkerFacialEnrollmentLinkStatus;
    expiresAt: string;
    consumedAt: string | null;
    revokedAt: string | null;
    createdAt: string;
  } | null;
  canGenerate: boolean;
}

export interface PublicFacialEnrollmentUnlockResponse {
  workerFirstName: string;
  expiresAt: string;
  consentText: string;
  consentVersion: string;
  notice: string;
}

export interface PublicFacialEnrollmentCompleteResponse {
  ok: true;
  workerFirstName: string;
  message: string;
  completedAt: string;
}

export interface WorkerFacialReferenceMeta {
  workerId: string;
  workerName?: string;
  hasActiveReference: boolean;
  hasBiometricTemplate: boolean;
  status: WorkerFacialReferenceStatus;
  reference: {
    id: string;
    status: 'ACTIVE' | 'REVOKED' | 'NEEDS_REENROLLMENT';
    uploadedAt: string;
    revokedAt: string | null;
    mimeType: string | null;
    byteSize: number | null;
    consentAcceptedAt: string | null;
    hasDescriptor: boolean;
    faceEngine: string | null;
    faceEngineVersion: string | null;
    qualityScore: number | null;
    imagePath: string | null;
    deletionStatus: WorkerBiometricDeletionStatus;
    deletedAt: string | null;
    deletionError: string | null;
    retentionUntil: string | null;
    hasFile: boolean;
    canRequestDeletion: boolean;
    /** Template ok, mas arquivo de foto ausente no storage. */
    imageMissing?: boolean;
  } | null;
  notice: string;
}

export interface PortalDeliveryListItem {
  id: string;
  receiptNumber: string;
  status: PortalDeliveryStatus;
  statusLabel: string;
  deliveredAt: string;
  notes: string | null;
  worker: {
    id: string;
    name: string;
    registration: string | null;
  };
  deliveredBy: {
    id: string;
    name: string;
    email: string;
  };
  itemCount: number;
  items: Array<{
    id: string;
    needName: string;
    epiName: string;
    caNumber: string | null;
    locationName: string;
    quantity: number;
  }>;
  method:
    | 'Facial capturada'
    | 'Conferencia visual confirmada'
    | 'Biometria facial aprovada'
    | 'Sem evidencia';
  evidence: {
    id: string;
    type: 'FACIAL_CAPTURE';
    statusLabel: PortalDeliveryEvidenceStatusLabel;
    capturedAt: string;
    verificationStatus: PortalDeliveryEvidenceVerificationStatus;
  } | null;
}

export interface PortalDeliveriesListResponse {
  deliveries: PortalDeliveryListItem[];
}

export interface PortalDeliveryDetail {
  id: string;
  receiptNumber: string;
  status: PortalDeliveryStatus;
  statusLabel: string;
  deliveredAt: string;
  notes: string | null;
  client: {
    id: string;
    legalName: string;
    tradeName: string | null;
    cnpj: string;
  };
  worker: {
    id: string;
    name: string;
    registration: string | null;
    cpfMasked: string | null;
    unitId: string | null;
    unitName: string | null;
    sectorId: string | null;
    sectorName: string | null;
    jobFunctionId: string | null;
    jobFunctionName: string | null;
  };
  deliveredBy: {
    id: string;
    name: string;
    email: string;
  };
  cancellation: {
    cancelledAt: string;
    reason: string | null;
    cancelledBy: {
      id: string;
      name: string;
      email: string;
    } | null;
  } | null;
  items: Array<{
    id: string;
    epiNeedId: string;
    needName: string;
    epiItemId: string;
    epiName: string;
    caNumber: string | null;
    caExpiresAt: string | null;
    epiVariantId: string | null;
    variantName: string | null;
    stockLocationId: string;
    locationName: string;
    quantity: number;
    returnedQuantity: number;
    cancelledQuantity: number;
    availableQuantity: number;
    status: PortalDeliveryItemStatus;
    statusLabel: string;
    nextReplacementAt: string | null;
    usefulLifeValue: number | null;
    usefulLifeUnit: EpiUsefulLifeUnit | null;
    usefulLifeLabel: string | null;
    usageDaysPerWeek: number | null;
    usageFrequencyLabel: string | null;
    stockMovement: {
      id: string;
      type: string;
      quantity: number;
      previousQuantity: number;
      newQuantity: number;
    };
  }>;
  returns: Array<{
    id: string;
    returnedAt: string;
    reason: string;
    notes: string | null;
    returnedBy: {
      id: string;
      name: string;
      email: string;
    };
    items: Array<{
      id: string;
      deliveryItemId: string;
      needName: string;
      epiName: string;
      quantity: number;
      condition: PortalDeliveryReturnCondition;
      returnsToStock: boolean;
      stockMovementId: string | null;
      stockMovement: {
        id: string;
        type: string;
        quantity: number;
        newQuantity: number;
      } | null;
    }>;
  }>;
  actions: {
    canCancel: boolean;
    canReturn: boolean;
  };
  evidence: {
    id: string;
    type: 'FACIAL_CAPTURE';
    method:
      | 'Facial capturada'
      | 'Conferencia visual confirmada'
      | 'Biometria facial aprovada'
      | 'Biometria facial rejeitada'
      | 'Sem verificacao';
    statusLabel: PortalDeliveryEvidenceStatusLabel;
    capturedAt: string;
    verificationStatus: PortalDeliveryEvidenceVerificationStatus;
    matchDistance: number | null;
    matchThreshold: number | null;
    faceEngine: string | null;
    verifiedAt: string | null;
    hasFile: boolean;
    deletionStatus: WorkerBiometricDeletionStatus;
    fileRemovedByRetention: boolean;
  } | null;
  consent: {
    accepted: boolean;
    acceptedAt: string | null;
    version: string | null;
    text: string | null;
    /** Snapshot LGPD biométrico vigente no ato da entrega. */
    biometric: {
      status: 'GRANTED' | 'REVOKED' | null;
      version: string | null;
      grantedAt: string | null;
    };
  };
  /** Declaracao/termo NR-06 exibido no recibo (texto versionado). */
  declaration: {
    version: string;
    text: string;
  };
  createdAt: string;
  updatedAt: string;
}

/** Ficha individual de EPI do trabalhador (historico imprimivel). */
export interface PortalWorkerEpiSheetDeliveryItem {
  id: string;
  needName: string;
  epiName: string;
  caNumber: string | null;
  quantity: number;
  returnedQuantity: number;
  cancelledQuantity: number;
  status: PortalDeliveryItemStatus;
  statusLabel: string;
  nextReplacementAt: string | null;
  usefulLifeLabel: string | null;
  usageFrequencyLabel: string | null;
  locationName: string;
}

export interface PortalWorkerEpiSheetDelivery {
  id: string;
  receiptNumber: string;
  status: PortalDeliveryStatus;
  statusLabel: string;
  deliveredAt: string;
  items: PortalWorkerEpiSheetDeliveryItem[];
  evidence: {
    id: string;
    capturedAt: string;
    verificationStatus: PortalDeliveryEvidenceVerificationStatus;
    hasFile: boolean;
    fileRemovedByRetention: boolean;
  } | null;
}

export interface PortalWorkerEpiSheetResponse {
  generatedAt: string;
  period: {
    from: string | null;
    to: string | null;
  };
  client: {
    id: string;
    legalName: string;
    tradeName: string | null;
    cnpj: string;
  };
  worker: {
    id: string;
    name: string;
    registration: string | null;
    cpfMasked: string | null;
    unitName: string | null;
    sectorName: string | null;
    jobFunctionName: string | null;
    status: 'ACTIVE' | 'INACTIVE';
  };
  summary: {
    deliveryCount: number;
    itemCount: number;
  };
  deliveries: PortalWorkerEpiSheetDelivery[];
  declaration: {
    version: string;
    text: string;
  };
}

export interface PortalCreateDeliveryItemInput {
  epiNeedId: string;
  epiItemId: string;
  epiVariantId?: string | null;
  stockLocationId: string;
  quantity: number;
  /** Override opcional da vida util (senao usa catalogo / periodicidade da funcao). */
  usefulLifeValue?: number | null;
  usefulLifeUnit?: EpiUsefulLifeUnit | null;
  /** 1-7 dias de uso por semana. Null/omitido = uso diario. */
  usageDaysPerWeek?: number | null;
}

export interface PortalCreateDeliveryPayload {
  workerId: string;
  items: PortalCreateDeliveryItemInput[];
  notes?: string | null;
  facialEvidenceConsentAccepted: true;
  /** Descritor 128-d extraido no browser (face-api). Matching no backend. */
  faceDescriptor: number[];
  faceEngine?: string;
  faceEngineVersion?: string;
  faceDetectionScore?: number;
}

export interface PortalCancelDeliveryPayload {
  reason: string;
}

export interface PortalCreateReturnPayload {
  reason: string;
  notes?: string | null;
  items: Array<{
    deliveryItemId: string;
    quantity: number;
    condition: PortalDeliveryReturnCondition;
  }>;
}

/** Filtros comuns dos relatorios operacionais do portal (query string). */
export interface PortalReportFiltersQuery {
  from?: string;
  to?: string;
  workerId?: string;
  unitId?: string;
  sectorId?: string;
  jobFunctionId?: string;
  epiNeedId?: string;
  epiItemId?: string;
  status?: string;
  stockLocationId?: string;
  stockStatus?: string;
}

export interface PortalReportFiltersMeta {
  units: Array<{ id: string; name: string }>;
  sectors: Array<{ id: string; name: string }>;
  jobs: Array<{ id: string; name: string; sectorId: string | null }>;
  workers: Array<{ id: string; name: string }>;
}

export interface PortalReportsOverviewResponse {
  period: { from: string; to: string };
  cards: {
    deliveriesInPeriod: number;
    itemsDelivered: number;
    returnsInPeriod: number;
    cancellationsInPeriod: number;
    workersActive: number;
    needsWithoutLinkedEpi: number;
    needsWithoutStock: number;
    stockLowOrZero: number;
    stockLow: number;
    stockZero: number;
  };
  cost: {
    estimatedDeliveredCost: number | null;
    available: boolean;
    message: string;
  };
}

export interface PortalReportsDeliveriesResponse {
  period: { from: string; to: string };
  rows: Array<{
    id: string;
    receiptNumber: string;
    deliveredAt: string;
    status: PortalDeliveryStatus;
    statusLabel: string;
    worker: {
      id: string;
      name: string;
      registration: string | null;
      unitName: string | null;
      sectorName: string | null;
      jobFunctionName: string | null;
    };
    itemsSummary: string;
    itemCount: number;
    operatorName: string;
    hasFacialEvidence: boolean;
  }>;
}

export type PortalReportStockStatus = 'ok' | 'baixo' | 'zerado';

export interface PortalReportsStockResponse {
  summary: {
    total: number;
    ok: number;
    baixo: number;
    zerado: number;
  };
  rows: Array<{
    epiItemId: string;
    epiName: string;
    caNumber: string | null;
    caExpiresAt: string | null;
    category: string | null;
    needs: Array<{ id: string; name: string }>;
    needsLabel: string;
    stockLocationId: string;
    locationName: string;
    quantity: number;
    minQuantity: number | null;
    status: PortalReportStockStatus;
    statusLabel: string;
  }>;
}

export type PortalReportReturnType = 'DEVOLUCAO' | 'CANCELAMENTO';

export interface PortalReportsReturnsResponse {
  period: { from: string; to: string };
  rows: Array<{
    id: string;
    at: string;
    type: PortalReportReturnType;
    typeLabel: string;
    receiptNumber: string;
    deliveryId: string;
    workerName: string;
    workerRegistration: string | null;
    itemLabel: string;
    quantity: number;
    condition: string | null;
    returnedToStock: boolean | null;
    reason: string | null;
    operatorName: string | null;
  }>;
}

export type PortalReportCoverageNeedStatus =
  | 'DISPONIVEL'
  | 'SEM_ESTOQUE'
  | 'SEM_EPI_REAL_VINCULADO';

export interface PortalReportsCoverageResponse {
  summary: {
    totalNeeds: number;
    disponivel: number;
    semEstoque: number;
    semEpiReal: number;
  };
  byJobFunction: Array<{
    jobFunctionId: string;
    jobFunctionName: string;
    sectorId: string | null;
    sectorName: string | null;
    needs: Array<{
      epiNeedId: string;
      needName: string;
      isRequired: boolean;
      quantity: number;
      replacementIntervalDays: number | null;
      risks: Array<{ id: string; name: string }>;
      warnings: string[];
      linkedEpiCount: number;
      availableStock: number;
      status: PortalReportCoverageNeedStatus;
      statusLabel: string;
    }>;
  }>;
}


