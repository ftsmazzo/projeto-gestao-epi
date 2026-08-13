import { EpiUsefulLifeUnit } from '@prisma/client';

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

export function computeNextReplacementAt(input: {
  deliveredAt: Date;
  /** Periodicidade da funcao (dias corridos), se nao houver vida util do EPI. */
  replacementIntervalDays?: number | null;
  usefulLifeValue?: number | null;
  usefulLifeUnit?: EpiUsefulLifeUnit | string | null;
  usageDaysPerWeek?: number | null;
}): Date | null {
  const { deliveredAt } = input;
  const fromLife = usefulLifeToBaseDays(
    input.usefulLifeValue,
    input.usefulLifeUnit,
  );
  const days =
    fromLife ??
    (input.replacementIntervalDays != null && input.replacementIntervalDays > 0
      ? input.replacementIntervalDays
      : null);
  if (days == null) return null;
  const next = new Date(deliveredAt);
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
): string | null {
  if (value == null || !unit) return null;
  const label =
    unit === 'DIAS' ? 'dia(s)' : unit === 'MESES' ? 'mes(es)' : 'ano(s)';
  return `${value} ${label}`;
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
