export class LotRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LotRuleError';
  }
}

export type LotStock = {
  id: string;
  code: string;
  quantity: number;
  expiresOn: string | null;
  createdAt: string;
};

export function normalizeLotCode(value: string | null | undefined): string | null {
  const code = value?.trim() ?? '';
  if (!code) return null;
  if (code.length > 40) {
    throw new LotRuleError('O codigo do lote tem no maximo 40 caracteres.');
  }
  return code;
}

export function parseExpiryDay(value: string | null | undefined): Date | null {
  const day = value?.trim() ?? '';
  if (!day) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    throw new LotRuleError('A validade usa o formato AAAA-MM-DD.');
  }
  const parsed = new Date(`${day}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== day) {
    throw new LotRuleError('A validade usa o formato AAAA-MM-DD.');
  }
  return parsed;
}

export function formatExpiryDay(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

/** Lote com validade sai antes. Sem validade fica para o fim. Empate usa o mais antigo. */
export function allocateFefo(lots: LotStock[], quantity: number): { id: string; quantity: number }[] {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new LotRuleError('A quantidade precisa ser um inteiro maior que zero.');
  }
  const ordered = lots
    .filter((lot) => lot.quantity > 0)
    .sort((left, right) => {
      if (left.expiresOn == null && right.expiresOn != null) return 1;
      if (left.expiresOn != null && right.expiresOn == null) return -1;
      if (left.expiresOn != null && right.expiresOn != null && left.expiresOn !== right.expiresOn) {
        return left.expiresOn < right.expiresOn ? -1 : 1;
      }
      return left.createdAt < right.createdAt ? -1 : left.createdAt > right.createdAt ? 1 : 0;
    });
  let remaining = quantity;
  const taken: { id: string; quantity: number }[] = [];
  for (const lot of ordered) {
    if (remaining === 0) break;
    const quantityTaken = Math.min(lot.quantity, remaining);
    taken.push({ id: lot.id, quantity: quantityTaken });
    remaining -= quantityTaken;
  }
  if (remaining > 0) {
    throw new LotRuleError('O saldo dos lotes nao cobre esta saida.');
  }
  return taken;
}
