import { EpiUsefulLifeUnit } from '@prisma/client';

/** Aviso de troca: entra na fila 15 dias antes do vencimento. */
export const REPLACEMENT_WARN_DAYS = 15;
/** Urgente: 3 dias ou ja vencido. */
export const REPLACEMENT_CRITICAL_DAYS = 3;
/**
 * Consumiveis curtos (PFF, etc.): a empresa entrega varias unidades.
 * O prazo da entrega e vida util × quantidade.
 */
export const SHORT_LIFE_PACK_MAX_DAYS = 5;

/** Converte vida util catalogada para dias-base de uso. */
export function usefulLifeToBaseDays(
  value: number | null | undefined,
  unit: EpiUsefulLifeUnit | string | null | undefined,
): number | null {
  if (value == null || value <= 0 || !unit) return null;
  if (unit === EpiUsefulLifeUnit.DIAS || unit === 'DIAS') return value;
  if (unit === EpiUsefulLifeUnit.MESES || unit === 'MESES') return value * 30;
  if (unit === EpiUsefulLifeUnit.ANOS || unit === 'ANOS') return value * 365;
  return null;
}

/**
 * Vida util e dia corrido: 1 uso ou 100 no periodo nao mudam a data.
 * usageDaysPerWeek e ignorado (mantido so por compat de assinatura).
 */
export function applyUsageFrequencyToCalendarDays(
  baseDays: number,
  _usageDaysPerWeek?: number | null,
): number {
  return Math.max(1, Math.floor(baseDays));
}

export function effectiveUsefulLifeDays(input: {
  usefulLifeValue?: number | null;
  usefulLifeUnit?: EpiUsefulLifeUnit | string | null;
  replacementIntervalDays?: number | null;
  quantity?: number | null;
}): number | null {
  const fromLife = usefulLifeToBaseDays(
    input.usefulLifeValue,
    input.usefulLifeUnit,
  );
  const unitDays =
    fromLife ??
    (input.replacementIntervalDays != null && input.replacementIntervalDays > 0
      ? input.replacementIntervalDays
      : null);
  if (unitDays == null || unitDays <= 0) return null;
  const qty = Math.max(1, Math.floor(input.quantity ?? 1));
  if (unitDays <= SHORT_LIFE_PACK_MAX_DAYS && qty > 1) {
    return unitDays * qty;
  }
  return unitDays;
}

export function computeNextReplacementAt(input: {
  deliveredAt: Date;
  /** Periodicidade da funcao (dias corridos), se nao houver vida util do EPI. */
  replacementIntervalDays?: number | null;
  usefulLifeValue?: number | null;
  usefulLifeUnit?: EpiUsefulLifeUnit | string | null;
  usageDaysPerWeek?: number | null;
  quantity?: number | null;
}): Date | null {
  const days = effectiveUsefulLifeDays(input);
  if (days == null) return null;
  const next = new Date(input.deliveredAt);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function calendarDaysRemaining(next: Date, from: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.ceil((next.getTime() - from.getTime()) / msPerDay);
}

export function formatRemainingDays(days: number | null | undefined): string | null {
  if (days == null || !Number.isFinite(days)) return null;
  if (days < 0) return `Vencido ha ${Math.abs(days)} dia(s)`;
  if (days === 0) return 'Vence hoje';
  return `${days} dia(s) restante(s)`;
}

export function formatUsefulLifeSnapshot(
  value: number | null | undefined,
  unit: string | null | undefined,
  quantity?: number | null,
): string | null {
  if (value == null || !unit) return null;
  const label =
    unit === 'DIAS' ? 'dia(s)' : unit === 'MESES' ? 'mes(es)' : 'ano(s)';
  const base = `${value} ${label}`;
  const unitDays = usefulLifeToBaseDays(value, unit);
  const qty = Math.max(1, Math.floor(quantity ?? 1));
  if (unitDays != null && unitDays <= SHORT_LIFE_PACK_MAX_DAYS && qty > 1) {
    return `${base} × ${qty} un. (${unitDays * qty} d)`;
  }
  return base;
}

export function formatUsageFrequencyLabel(
  usageDaysPerWeek: number | null | undefined,
): string | null {
  if (usageDaysPerWeek == null || usageDaysPerWeek <= 0) return null;
  const n = Math.min(7, Math.max(1, Math.floor(usageDaysPerWeek)));
  if (n >= 7) return 'Uso diario';
  if (n === 1) return '1 dia por semana';
  return `${n} dias por semana`;
}
