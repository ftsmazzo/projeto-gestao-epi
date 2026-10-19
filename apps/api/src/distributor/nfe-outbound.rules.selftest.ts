/**
 * Uso: npx --yes tsx src/distributor/nfe-outbound.rules.selftest.ts
 */
import {
  NfeOutboundError,
  OUTBOUND_EMISSION_ENABLED,
  assertOutboundAuthorize,
  buildOutboundLines,
  lineNetUnitCents,
  outboundBlockers,
  pickSaleCfop,
} from './nfe-outbound.rules';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

assert(pickSaleCfop('ES', 'ES', '5102', '6102') === '5102', 'CFOP interno');
assert(pickSaleCfop('ES', 'SP', '5102', '6102') === '6102', 'CFOP interestadual');
assert(lineNetUnitCents({ unitPriceCents: 10000, discountBps: 1000 }) === 9000, 'desconto 10%');

const lines = buildOutboundLines({
  emitterUf: 'ES',
  customerUf: 'RJ',
  lines: [
    {
      variantId: 'v1',
      quantity: 2,
      unitPriceCents: 1250,
      discountBps: 0,
      product: {
        name: 'Luva de vaqueta',
        sizeLabel: 'G',
        ncm: '42032900',
        originCode: 0,
        cest: null,
        saleCfopIn: '5102',
        saleCfopOut: '6102',
        icmsSt: false,
      },
    },
  ],
});
assert(lines.length === 1, 'uma linha');
assert(lines[0].cfop === '6102', 'CFOP da linha');
assert(lines[0].totalCents === 2500, 'total da linha');
assert(lines[0].ncm === '42032900', 'NCM');

let missingNcm = false;
try {
  buildOutboundLines({
    emitterUf: 'ES',
    customerUf: 'ES',
    lines: [
      {
        variantId: 'v2',
        quantity: 1,
        unitPriceCents: 100,
        discountBps: 0,
        product: {
          name: 'Sem NCM',
          sizeLabel: 'Unico',
          ncm: null,
          originCode: 0,
          cest: null,
          saleCfopIn: '5102',
          saleCfopOut: '6102',
          icmsSt: false,
        },
      },
    ],
  });
} catch (error) {
  missingNcm = error instanceof NfeOutboundError;
}
assert(missingNcm, 'NCM obrigatorio');

const blockers = outboundBlockers({
  emitterCnpj: null,
  emitterUf: 'ES',
  certificateUploaded: false,
  lines: [{ ncm: '42032900', cfop: '5102' }],
});
assert(blockers.includes('CNPJ do emitente'), 'bloqueia sem CNPJ');
assert(blockers.includes('Certificado A1'), 'bloqueia sem A1');

let gated = false;
try {
  assertOutboundAuthorize({
    status: 'DRAFT',
    blockers: [],
    emissionEnabled: OUTBOUND_EMISSION_ENABLED,
  });
} catch (error) {
  gated =
    error instanceof NfeOutboundError &&
    error.message.includes('ainda nao esta ligada');
}
assert(gated, 'autorizacao gated');
assert(OUTBOUND_EMISSION_ENABLED === false, 'emissao desligada');

console.log('nfe-outbound.rules.selftest ok');
