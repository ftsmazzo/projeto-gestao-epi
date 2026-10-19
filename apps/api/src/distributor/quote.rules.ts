export type QuoteDecision = 'APPROVED' | 'PENDING_APPROVAL';

export class QuoteRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuoteRuleError';
  }
}

export function percentToBps(percent: number): number {
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    throw new QuoteRuleError('O desconto precisa ficar entre 0 e 100.');
  }
  const bps = Math.round(percent * 100);
  if (bps < 0 || bps > 10000) {
    throw new QuoteRuleError('O desconto precisa ficar entre 0 e 100.');
  }
  return bps;
}

export function bpsToPercent(bps: number): number {
  return Math.round(bps) / 100;
}

export function lineGrantedCents(line: {
  quantity: number;
  unitPriceCents: number;
  discountBps: number;
}): number {
  if (
    !Number.isInteger(line.quantity) ||
    line.quantity < 1 ||
    !Number.isInteger(line.unitPriceCents) ||
    line.unitPriceCents < 0 ||
    !Number.isInteger(line.discountBps) ||
    line.discountBps < 0 ||
    line.discountBps > 10000
  ) {
    throw new QuoteRuleError(
      'Informe quantidade, preco e desconto validos em cada item.',
    );
  }
  return Math.round(
    (line.unitPriceCents * line.quantity * line.discountBps) / 10000,
  );
}

export function decideQuote(input: {
  lines: Array<{
    quantity: number;
    unitPriceCents: number;
    discountBps: number;
  }>;
  sellerMaxDiscountBps: number;
}): { status: QuoteDecision; grantedCents: number } {
  if (!Number.isInteger(input.sellerMaxDiscountBps) || input.sellerMaxDiscountBps < 0) {
    throw new QuoteRuleError('O teto do vendedor esta invalido.');
  }
  if (input.lines.length === 0) {
    throw new QuoteRuleError('Inclua ao menos um item no orcamento.');
  }
  let grantedCents = 0;
  let needsApproval = false;
  for (const line of input.lines) {
    grantedCents += lineGrantedCents(line);
    if (line.discountBps > input.sellerMaxDiscountBps) needsApproval = true;
  }
  return {
    status: needsApproval ? 'PENDING_APPROVAL' : 'APPROVED',
    grantedCents,
  };
}

export function sumGrantedCents(
  quotes: Array<{ status: string; grantedCents: number }>,
): number {
  return quotes.reduce(
    (total, quote) =>
      quote.status === 'APPROVED' ? total + quote.grantedCents : total,
    0,
  );
}
