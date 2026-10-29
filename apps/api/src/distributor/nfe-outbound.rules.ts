export class NfeOutboundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NfeOutboundError';
  }
}

/**
 * Emissao assinada na SEFAZ.
 * Padrao: desligada. Liga no go-live com OUTBOUND_EMISSION_ENABLED=true|1 no ambiente.
 */
export const OUTBOUND_EMISSION_ENABLED = (() => {
  const raw = (process.env.OUTBOUND_EMISSION_ENABLED ?? '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
})();

export type OutboundProductSnapshot = {
  name: string;
  sizeLabel: string;
  ncm: string | null;
  originCode: number;
  cest: string | null;
  saleCfopIn: string;
  saleCfopOut: string;
  icmsSt: boolean;
};

export type OutboundQuoteLineInput = {
  variantId: string;
  quantity: number;
  unitPriceCents: number;
  discountBps: number;
  product: OutboundProductSnapshot;
};

export type OutboundBuiltLine = {
  variantId: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  discountBps: number;
  ncm: string;
  cfop: string;
  originCode: number;
  cest: string | null;
  icmsSt: boolean;
  totalCents: number;
};

export function pickSaleCfop(
  emitterUf: string,
  customerUf: string,
  saleCfopIn: string,
  saleCfopOut: string,
): string {
  const emitter = emitterUf.trim().toUpperCase();
  const customer = customerUf.trim().toUpperCase();
  if (emitter.length !== 2 || customer.length !== 2) {
    throw new NfeOutboundError('Informe a UF do emitente e do destinatario.');
  }
  return emitter === customer ? saleCfopIn : saleCfopOut;
}

export function lineNetUnitCents(input: {
  unitPriceCents: number;
  discountBps: number;
}): number {
  if (
    !Number.isInteger(input.unitPriceCents) ||
    input.unitPriceCents < 0 ||
    !Number.isInteger(input.discountBps) ||
    input.discountBps < 0 ||
    input.discountBps > 10000
  ) {
    throw new NfeOutboundError('Preco ou desconto invalido no item da nota.');
  }
  return Math.round((input.unitPriceCents * (10000 - input.discountBps)) / 10000);
}

export function buildOutboundLines(input: {
  emitterUf: string;
  customerUf: string;
  lines: OutboundQuoteLineInput[];
}): OutboundBuiltLine[] {
  if (input.lines.length === 0) {
    throw new NfeOutboundError('Inclua ao menos um item na nota de saida.');
  }
  return input.lines.map((line) => {
    if (!Number.isInteger(line.quantity) || line.quantity < 1) {
      throw new NfeOutboundError('A quantidade de cada item precisa ser inteira e positiva.');
    }
    const ncm = (line.product.ncm ?? '').replace(/\D/g, '');
    if (ncm.length !== 8) {
      throw new NfeOutboundError(
        `O produto ${line.product.name} precisa de NCM com 8 digitos antes da nota.`,
      );
    }
    const unitPriceCents = lineNetUnitCents({
      unitPriceCents: line.unitPriceCents,
      discountBps: line.discountBps,
    });
    const size = line.product.sizeLabel.trim() || 'Unico';
    const cfop = pickSaleCfop(
      input.emitterUf,
      input.customerUf,
      line.product.saleCfopIn,
      line.product.saleCfopOut,
    );
    return {
      variantId: line.variantId,
      description: `${line.product.name} · ${size}`.slice(0, 120),
      quantity: line.quantity,
      unitPriceCents,
      discountBps: line.discountBps,
      ncm,
      cfop,
      originCode: line.product.originCode,
      cest: line.product.cest,
      icmsSt: line.product.icmsSt,
      totalCents: unitPriceCents * line.quantity,
    };
  });
}

export function outboundBlockers(input: {
  emitterCnpj: string | null | undefined;
  emitterUf: string | null | undefined;
  certificateUploaded: boolean;
  lines: Array<{ ncm: string; cfop: string }>;
}): string[] {
  const missing: string[] = [];
  if (!input.emitterCnpj) missing.push('CNPJ do emitente');
  if (!input.emitterUf) missing.push('UF do emitente');
  if (!input.certificateUploaded) missing.push('Certificado A1');
  if (input.lines.length === 0) missing.push('Itens da nota');
  for (const line of input.lines) {
    if (!/^\d{8}$/.test(line.ncm)) missing.push(`NCM ${line.ncm || 'vazio'}`);
    if (!/^\d{4}$/.test(line.cfop)) missing.push(`CFOP ${line.cfop || 'vazio'}`);
  }
  return [...new Set(missing)];
}

export function assertOutboundConfirm(status: string): void {
  if (status !== 'DRAFT') {
    throw new NfeOutboundError('So o rascunho pode confirmar a saida no estoque.');
  }
}

export function assertOutboundAuthorize(input: {
  status: string;
  blockers: string[];
  emissionEnabled?: boolean;
}): void {
  if (input.status !== 'CONFIRMED') {
    throw new NfeOutboundError(
      'Confirme a saida no estoque antes de autorizar a NF-e na SEFAZ.',
    );
  }
  if (input.blockers.length > 0) {
    throw new NfeOutboundError(
      `A nota ainda nao esta pronta: ${input.blockers.join(', ')}.`,
    );
  }
  const enabled = input.emissionEnabled ?? OUTBOUND_EMISSION_ENABLED;
  if (!enabled) {
    throw new NfeOutboundError(
      'A autorizacao na SEFAZ ainda nao esta ligada. Cadastre o certificado e aguarde a homologacao.',
    );
  }
}
