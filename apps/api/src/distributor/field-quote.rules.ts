import {
  AgendaRuleError,
  normalizeNextAction,
  normalizeVisitSummary,
  parseVisitedAt,
} from './agenda.rules';
import {
  QuoteRuleError,
  decideQuote,
  percentToBps,
} from './quote.rules';

export class FieldQuoteRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FieldQuoteRuleError';
  }
}

export function normalizeFieldVisitSummary(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) {
    return 'Orcamento montado em visita.';
  }
  try {
    return normalizeVisitSummary(trimmed);
  } catch (error) {
    if (error instanceof AgendaRuleError) {
      throw new FieldQuoteRuleError(error.message);
    }
    throw error;
  }
}

export function normalizeFieldVisitedAt(value: string): Date {
  try {
    return parseVisitedAt(value);
  } catch (error) {
    if (error instanceof AgendaRuleError) {
      throw new FieldQuoteRuleError(error.message);
    }
    throw error;
  }
}

export function normalizeFieldNextAction(value: string | null | undefined): string | null {
  try {
    return normalizeNextAction(value);
  } catch (error) {
    if (error instanceof AgendaRuleError) {
      throw new FieldQuoteRuleError(error.message);
    }
    throw error;
  }
}

export function buildFieldQuoteLines(
  lines: Array<{
    variantId: string;
    quantity: number;
    unitPriceCents: number;
    discountPercent: number;
  }>,
) {
  try {
    return lines.map((line) => ({
      variantId: line.variantId,
      quantity: line.quantity,
      unitPriceCents: line.unitPriceCents,
      discountBps: percentToBps(line.discountPercent),
    }));
  } catch (error) {
    if (error instanceof QuoteRuleError) {
      throw new FieldQuoteRuleError(error.message);
    }
    throw error;
  }
}

export function decideFieldQuote(input: {
  lines: Array<{
    quantity: number;
    unitPriceCents: number;
    discountBps: number;
  }>;
  sellerMaxDiscountBps: number;
}) {
  try {
    return decideQuote(input);
  } catch (error) {
    if (error instanceof QuoteRuleError) {
      throw new FieldQuoteRuleError(error.message);
    }
    throw error;
  }
}

export function bpsToPercentLabel(bps: number): number {
  return Math.round(bps) / 100;
}
