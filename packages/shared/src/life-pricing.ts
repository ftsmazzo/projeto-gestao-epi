export type ClientSubscriptionStatus =
  | 'TRIAL'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'SUSPENDED';

export type ClientSubscriptionSuspendReason =
  | 'NON_PAYMENT'
  | 'TRIAL_EXPIRED'
  | 'MANUAL';

export interface LifePriceReducer {
  id: string;
  minLives: number;
  percentOff: number;
  label: string | null;
}

export interface OrganizationLifePricing {
  id: string;
  organizationId: string;
  unitPriceCents: number;
  currency: string;
  defaultTrialDays: number;
  defaultTrialLives: number;
  reducers: LifePriceReducer[];
  updatedAt: string;
}

export interface LifePriceQuote {
  lives: number;
  unitPriceCents: number;
  reducerPercent: number;
  reducerLabel: string | null;
  /** Custo da vida × quantidade de vidas, sem redutor. */
  grossMonthlyCents: number;
  /** Valor de tabela apos o redutor de volume (se houver). */
  tableMonthlyCents: number;
  chargedMonthlyCents: number;
  overrideCents: number | null;
}

export interface ClientSubscription {
  id: string;
  servedClientId: string;
  status: ClientSubscriptionStatus;
  trialLives: number | null;
  trialEndsAt: string | null;
  trialExpired: boolean;
  monthlyPriceCentsOverride: number | null;
  livesSnapshot: number | null;
  suspendReason: string | null;
  suspendedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClientSubscriptionRow {
  clientId: string;
  legalName: string;
  tradeName: string | null;
  cnpj: string;
  clientStatus: 'ACTIVE' | 'INACTIVE';
  allocatedLives: number;
  usedLives: number;
  subscription: ClientSubscription | null;
  quote: LifePriceQuote;
}

export interface SubscriptionsOverview {
  quota: {
    contracted: number;
    allocated: number;
    available: number;
    used: number;
  };
  pricing: OrganizationLifePricing;
  summary: {
    recurringMonthlyCents: number;
    trialCount: number;
    activeCount: number;
    pastDueCount: number;
    suspendedCount: number;
    withoutPlanCount: number;
  };
  clients: ClientSubscriptionRow[];
}

export const DEFAULT_LIFE_REDUCERS: Array<{
  minLives: number;
  percentOff: number;
  label: string;
}> = [
  { minLives: 10, percentOff: 5, label: '10+ vidas' },
  { minLives: 25, percentOff: 10, label: '25+ vidas' },
  { minLives: 50, percentOff: 15, label: '50+ vidas' },
  { minLives: 100, percentOff: 20, label: '100+ vidas' },
  { minLives: 200, percentOff: 30, label: '200+ vidas' },
];

export function clientSubscriptionStatusLabel(
  status: ClientSubscriptionStatus | null | undefined,
) {
  switch (status) {
    case 'TRIAL':
      return 'Periodo de teste';
    case 'ACTIVE':
      return 'Assinatura ativa';
    case 'PAST_DUE':
      return 'Pagamento em atraso';
    case 'SUSPENDED':
      return 'Inativo por falta de pagamento';
    default:
      return 'Sem plano';
  }
}

export function pickLifeReducer<T extends { minLives: number; percentOff: number }>(
  reducers: T[],
  lives: number,
): T | null {
  return (
    [...reducers]
      .filter((item) => item.minLives <= lives)
      .sort((a, b) => b.minLives - a.minLives)[0] ?? null
  );
}

export function quoteMonthlyCents(
  unitPriceCents: number,
  lives: number,
  reducers: Array<{ minLives: number; percentOff: number }>,
) {
  if (lives <= 0 || unitPriceCents <= 0) return 0;
  const reducer = pickLifeReducer(reducers, lives);
  const percentOff = Math.min(90, Math.max(0, reducer?.percentOff ?? 0));
  return Math.round((unitPriceCents * lives * (100 - percentOff)) / 100);
}

export function buildLifePriceQuote(input: {
  unitPriceCents: number;
  lives: number;
  reducers: Array<{
    minLives: number;
    percentOff: number;
    label?: string | null;
  }>;
  overrideCents?: number | null;
  complimentary?: boolean;
}): LifePriceQuote {
  const reducer = pickLifeReducer(input.reducers, input.lives);
  const grossMonthlyCents = Math.max(
    0,
    Math.round(input.unitPriceCents * Math.max(0, input.lives)),
  );
  const tableMonthlyCents = quoteMonthlyCents(
    input.unitPriceCents,
    input.lives,
    input.reducers,
  );
  const overrideCents =
    input.overrideCents === undefined ? null : input.overrideCents;
  const chargedMonthlyCents = input.complimentary
    ? 0
    : overrideCents !== null
      ? overrideCents
      : tableMonthlyCents;

  return {
    lives: input.lives,
    unitPriceCents: input.unitPriceCents,
    reducerPercent: reducer?.percentOff ?? 0,
    reducerLabel: reducer && 'label' in reducer ? (reducer.label ?? null) : null,
    grossMonthlyCents,
    tableMonthlyCents,
    chargedMonthlyCents,
    overrideCents,
  };
}

export function formatBrlFromCents(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}
