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
 * Ajusta dias de calendario pela frequencia de uso semanal.
 * Ex.: 30 dias de vida util com 3 dias/semana → ceil(30 * 7 / 3) = 70 dias.
 * Null ou 7 = uso diario (sem ajuste).
 */
export function applyUsageFrequencyToCalendarDays(
  baseDays: number,
  usageDaysPerWeek: number | null | undefined,
): number {
  const uses =
    usageDaysPerWeek == null || usageDaysPerWeek <= 0
      ? 7
      : Math.min(7, Math.max(1, Math.floor(usageDaysPerWeek)));
  if (uses >= 7) return baseDays;
  return Math.max(1, Math.ceil((baseDays * 7) / uses));
}

export function computeNextReplacementAt(input: {
  deliveredAt: Date;
  /** Periodicidade da funcao (dias de calendario), se houver. */
  replacementIntervalDays?: number | null;
  usefulLifeValue?: number | null;
  usefulLifeUnit?: EpiUsefulLifeUnit | string | null;
  usageDaysPerWeek?: number | null;
}): Date | null {
  const { deliveredAt } = input;
  const uses = input.usageDaysPerWeek;

  if (
    input.replacementIntervalDays != null &&
    input.replacementIntervalDays > 0
  ) {
    const days = applyUsageFrequencyToCalendarDays(
      input.replacementIntervalDays,
      uses,
    );
    const next = new Date(deliveredAt);
    next.setUTCDate(next.getUTCDate() + days);
    return next;
  }

  const baseDays = usefulLifeToBaseDays(
    input.usefulLifeValue,
    input.usefulLifeUnit,
  );
  if (baseDays == null) return null;

  const days = applyUsageFrequencyToCalendarDays(baseDays, uses);
  const next = new Date(deliveredAt);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
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
