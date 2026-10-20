export class AgendaRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgendaRuleError';
  }
}

export function normalizeCustomerName(value: string): string {
  const name = value.trim().replace(/\s+/g, ' ');
  if (name.length < 2) {
    throw new AgendaRuleError('Informe o nome do cliente.');
  }
  if (name.length > 120) {
    throw new AgendaRuleError('O nome do cliente e longo demais.');
  }
  return name;
}

export function normalizeVisitSummary(value: string): string {
  const summary = value.trim().replace(/\s+/g, ' ');
  if (summary.length < 3) {
    throw new AgendaRuleError('Descreva o que foi falado com o cliente.');
  }
  if (summary.length > 2000) {
    throw new AgendaRuleError('O resumo da visita e longo demais.');
  }
  return summary;
}

export function normalizeNextAction(value: string | null | undefined): string | null {
  if (value == null || value.trim() === '') return null;
  const next = value.trim().replace(/\s+/g, ' ');
  if (next.length > 500) {
    throw new AgendaRuleError('A proxima acao e longa demais.');
  }
  return next;
}

export function parseVisitedAt(value: string): Date {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new AgendaRuleError('Informe a data da visita como AAAA-MM-DD.');
  }
  const day = new Date(`${trimmed}T12:00:00.000Z`);
  if (Number.isNaN(day.getTime())) {
    throw new AgendaRuleError('Data da visita invalida.');
  }
  return day;
}

export function formatVisitedAt(value: Date): string {
  return value.toISOString().slice(0, 10);
}
