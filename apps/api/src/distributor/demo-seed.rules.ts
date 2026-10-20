export type DemoSeedProduct = {
  name: string;
  internalSku: string;
  supplierSku: string;
  caNumber: string | null;
  gtin: string;
  unitCode: 'UN' | 'PAR' | 'CX';
  sizes: string[];
  minQuantity: number;
  costCents: number;
  ncm: string;
  tracksLot: boolean;
  /** Quantidade inicial por tamanho para o teste. */
  openingQty: number;
};

/** Catálogo curto para o piloto — GTINs fictícios de 13 dígitos. */
export const DISTRIBUTOR_DEMO_PRODUCTS: DemoSeedProduct[] = [
  {
    name: 'Luva nitrílica azul',
    internalSku: 'LUVA-NIT-AZ',
    supplierSku: 'FORN-LUVA-01',
    caNumber: '12345',
    gtin: '7891000100001',
    unitCode: 'PAR',
    sizes: ['P', 'M', 'G'],
    minQuantity: 20,
    costCents: 1290,
    ncm: '40151900',
    tracksLot: false,
    openingQty: 50,
  },
  {
    name: 'Capacete de segurança',
    internalSku: 'CAP-SEG-01',
    supplierSku: 'FORN-CAP-01',
    caNumber: '23456',
    gtin: '7891000100002',
    unitCode: 'UN',
    sizes: ['Único'],
    minQuantity: 5,
    costCents: 4500,
    ncm: '65061000',
    tracksLot: false,
    openingQty: 30,
  },
  {
    name: 'Óculos de proteção incolor',
    internalSku: 'OCULOS-INC',
    supplierSku: 'FORN-OC-01',
    caNumber: '34567',
    gtin: '7891000100003',
    unitCode: 'UN',
    sizes: ['Único'],
    minQuantity: 10,
    costCents: 1890,
    ncm: '90049010',
    tracksLot: false,
    openingQty: 40,
  },
  {
    name: 'Protetor auricular plug',
    internalSku: 'AURIC-PLUG',
    supplierSku: 'FORN-AU-01',
    caNumber: '45678',
    gtin: '7891000100004',
    unitCode: 'PAR',
    sizes: ['Único'],
    minQuantity: 30,
    costCents: 350,
    ncm: '39269090',
    tracksLot: false,
    openingQty: 100,
  },
  {
    name: 'Bota de segurança com biqueira',
    internalSku: 'BOTA-BQ',
    supplierSku: 'FORN-BT-01',
    caNumber: '56789',
    gtin: '7891000100005',
    unitCode: 'PAR',
    sizes: ['38', '40', '42', '44'],
    minQuantity: 4,
    costCents: 12900,
    ncm: '64034000',
    tracksLot: false,
    openingQty: 12,
  },
  {
    name: 'Máscara PFF2',
    internalSku: 'MASC-PFF2',
    supplierSku: 'FORN-MS-01',
    caNumber: '67890',
    gtin: '7891000100006',
    unitCode: 'UN',
    sizes: ['Único'],
    minQuantity: 50,
    costCents: 290,
    ncm: '63079010',
    tracksLot: true,
    openingQty: 200,
  },
  {
    name: 'Avental de raspa',
    internalSku: 'AVENT-RASPA',
    supplierSku: 'FORN-AV-01',
    caNumber: null,
    gtin: '7891000100007',
    unitCode: 'UN',
    sizes: ['Único'],
    minQuantity: 3,
    costCents: 8900,
    ncm: '42032900',
    tracksLot: false,
    openingQty: 15,
  },
  {
    name: 'Cinto de segurança paraquedista',
    internalSku: 'CINTO-PQ',
    supplierSku: 'FORN-CT-01',
    caNumber: '78901',
    gtin: '7891000100008',
    unitCode: 'UN',
    sizes: ['Único'],
    minQuantity: 2,
    costCents: 25900,
    ncm: '63072000',
    tracksLot: false,
    openingQty: 8,
  },
  {
    name: 'Luva de vaqueta',
    internalSku: 'LUVA-VAQ',
    supplierSku: 'FORN-LV-02',
    caNumber: '89012',
    gtin: '7891000100009',
    unitCode: 'PAR',
    sizes: ['M', 'G'],
    minQuantity: 15,
    costCents: 2200,
    ncm: '42032900',
    tracksLot: false,
    openingQty: 35,
  },
  {
    name: 'Cone de sinalização',
    internalSku: 'CONE-SINAL',
    supplierSku: 'FORN-CN-01',
    caNumber: null,
    gtin: '7891000100010',
    unitCode: 'UN',
    sizes: ['Único'],
    minQuantity: 10,
    costCents: 3500,
    ncm: '39269090',
    tracksLot: false,
    openingQty: 25,
  },
];

export function demoSeedSummary(createdSkus: string[]) {
  return {
    createdCount: createdSkus.length,
    createdSkus,
    hint: 'Use o leitor na Entrada/Saida com os GTINs 7891000100001 a 7891000100010.',
  };
}
