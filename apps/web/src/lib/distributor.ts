import { apiFetch, getAccessToken, getApiUrl } from './auth';

export type DistributorLot = {
  id: string;
  code: string;
  quantity: number;
  expiresOn: string | null;
};

export type DistributorVariant = {
  id: string;
  label: string;
  quantity: number;
  lots: DistributorLot[];
};

export type DistributorProduct = {
  id: string;
  name: string;
  internalSku: string;
  supplierSku: string | null;
  ncm: string | null;
  caNumber: string | null;
  minQuantity: number | null;
  unitCode: string;
  itemsPerBox: number | null;
  gtin: string | null;
  warehouseLocation: string | null;
  costCents: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  netWeightKg: number | null;
  grossWeightKg: number | null;
  boxLengthCm: number | null;
  boxWidthCm: number | null;
  boxHeightCm: number | null;
  freightDivisor: number;
  originCode: number;
  cest: string | null;
  saleCfopIn: string;
  saleCfopOut: string;
  buyCfopIn: string;
  buyCfopOut: string;
  icmsSt: boolean;
  tracksLot: boolean;
  itemCubageM3: number | null;
  itemVolumetricWeightG: number | null;
  boxCubageM3: number | null;
  boxVolumetricWeightG: number | null;
  variants: DistributorVariant[];
};

export type DistributorCatalogInput = {
  unitCode?: string;
  itemsPerBox?: number | null;
  gtin?: string | null;
  warehouseLocation?: string | null;
  costCents?: number | null;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  netWeightKg?: number | null;
  grossWeightKg?: number | null;
  boxLengthCm?: number | null;
  boxWidthCm?: number | null;
  boxHeightCm?: number | null;
  originCode?: number;
  cest?: string | null;
  ncm?: string | null;
  saleCfopIn?: string;
  saleCfopOut?: string;
  buyCfopIn?: string;
  buyCfopOut?: string;
  icmsSt?: boolean;
};

export type DistributorBalanceRow = {
  productId: string;
  productName: string;
  internalSku: string;
  variantId: string;
  label: string;
  quantity: number;
  minQuantity: number | null;
  low: boolean;
  unitCode: string;
};

export type DistributorInboundLine = {
  id: string;
  description: string;
  quantity: number;
  unitCostCents: number | null;
  caNumber: string | null;
  variantId: string | null;
  lotCode: string | null;
  expiresOn: string | null;
};

export type DistributorInboundDocument = {
  id: string;
  status: 'DRAFT' | 'CONFIRMED' | 'DISCARDED';
  supplierName: string | null;
  invoiceNumber: string | null;
  fileName: string;
  message: string;
  lines: DistributorInboundLine[];
};

export type CaSuggestion = {
  found: boolean;
  caNumber: string;
  equipmentName?: string | null;
  equipmentDescription?: string | null;
  manufacturerName?: string | null;
  status?: string;
};

export function listDistributorProducts() {
  return apiFetch<DistributorProduct[]>('/distributor/products');
}

export function createDistributorProduct(
  input: DistributorCatalogInput & {
    name: string;
    internalSku: string;
    supplierSku?: string;
    caNumber?: string;
    minQuantity?: number;
    variants: string[];
    tracksLot?: boolean;
  },
) {
  return apiFetch<DistributorProduct>('/distributor/products', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateDistributorProduct(
  productId: string,
  input: DistributorCatalogInput & {
    name?: string;
    caNumber?: string | null;
    minQuantity?: number | null;
    tracksLot?: boolean;
  },
) {
  return apiFetch<DistributorProduct>(`/distributor/products/${productId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function addDistributorVariant(productId: string, label: string) {
  return apiFetch<DistributorProduct>(`/distributor/products/${productId}/variants`, {
    method: 'POST',
    body: JSON.stringify({ label }),
  });
}

export function updateDistributorMin(productId: string, minQuantity: number | null) {
  return updateDistributorProduct(productId, { minQuantity });
}

export function listDistributorBalances() {
  return apiFetch<DistributorBalanceRow[]>('/distributor/balances');
}

export function listDistributorLowStock() {
  return apiFetch<DistributorBalanceRow[]>('/distributor/alerts/low-stock');
}

export function lookupDistributorCa(caNumber: string) {
  return apiFetch<CaSuggestion>(
    `/distributor/ca/${encodeURIComponent(caNumber)}`,
  );
}

export function moveDistributorStock(input: {
  variantId: string;
  direction: 'IN' | 'OUT';
  quantity: number;
  lotCode?: string;
  expiresOn?: string;
}) {
  return apiFetch<{
    productName: string;
    label: string;
    balance: number;
    lotSummary: string | null;
  }>('/distributor/movements', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function extractDistributorInvoice(file: File) {
  const form = new FormData();
  form.append('file', file);
  const headers = new Headers();
  const token = getAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${getApiUrl()}/distributor/inbound/extract`, {
    method: 'POST',
    headers,
    body: form,
  });
  if (!response.ok) {
    let message = `Erro HTTP ${response.status}`;
    try {
      const body = (await response.json()) as { message?: string | string[] };
      if (Array.isArray(body.message)) message = body.message.join(', ');
      else if (body.message) message = body.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  return (await response.json()) as DistributorInboundDocument;
}

export function linkDistributorLine(
  documentId: string,
  lineId: string,
  variantId: string | null,
  lot?: { lotCode?: string | null; expiresOn?: string | null },
) {
  return apiFetch<DistributorInboundDocument>(
    `/distributor/inbound/${documentId}/lines/${lineId}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ variantId, ...lot }),
    },
  );
}

export function confirmDistributorInbound(documentId: string) {
  return apiFetch<DistributorInboundDocument>(
    `/distributor/inbound/${documentId}/confirm`,
    { method: 'POST' },
  );
}

export function discardDistributorInbound(documentId: string) {
  return apiFetch<DistributorInboundDocument>(
    `/distributor/inbound/${documentId}/discard`,
    { method: 'POST' },
  );
}

export type PurchaseOrderStatus =
  | 'AWAITING_FIRST'
  | 'AWAITING_SECOND'
  | 'APPROVED'
  | 'REJECTED'
  | 'RECEIVED';

export type PurchaseOrderLine = {
  id: string;
  variantId: string;
  productName: string;
  label: string;
  quantity: number;
  unitCostCents: number | null;
  lotCode: string | null;
  expiresOn: string | null;
};

export type PurchaseOrder = {
  id: string;
  supplierName: string;
  status: PurchaseOrderStatus;
  createdAt: string;
  firstApprovedByUserId: string | null;
  secondApprovedByUserId: string | null;
  rejectionNote: string | null;
  lines: PurchaseOrderLine[];
};

export function listPurchaseOrders() {
  return apiFetch<PurchaseOrder[]>('/distributor/purchase-orders');
}

export function createPurchaseOrder(input: {
  supplierName: string;
  lines: Array<{
    variantId: string;
    quantity: number;
    unitCostCents?: number;
    lotCode?: string;
    expiresOn?: string;
  }>;
}) {
  return apiFetch<PurchaseOrder>('/distributor/purchase-orders', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function releasePurchaseOrder(orderId: string, step: 1 | 2) {
  const action = step === 1 ? 'first-release' : 'second-release';
  return apiFetch<PurchaseOrder>(
    `/distributor/purchase-orders/${orderId}/${action}`,
    { method: 'POST' },
  );
}

export function rejectPurchaseOrder(orderId: string, note?: string) {
  return apiFetch<PurchaseOrder>(
    `/distributor/purchase-orders/${orderId}/reject`,
    {
      method: 'POST',
      body: JSON.stringify({ note }),
    },
  );
}

export function receivePurchaseOrder(orderId: string) {
  return apiFetch<PurchaseOrder>(
    `/distributor/purchase-orders/${orderId}/receive`,
    { method: 'POST' },
  );
}

export type SellerCeiling = {
  userId: string;
  name: string;
  role: string;
  maxDiscountBps: number;
};

export type QuoteStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';

export type QuoteLine = {
  id: string;
  variantId: string;
  productName: string;
  label: string;
  quantity: number;
  unitPriceCents: number;
  discountBps: number;
};

export type DistributorQuote = {
  id: string;
  customerName: string;
  sellerUserId: string;
  status: QuoteStatus;
  grantedCents: number;
  approvedAt: string | null;
  createdAt: string;
  lines: QuoteLine[];
};

export function listSellers() {
  return apiFetch<SellerCeiling[]>('/distributor/sellers');
}

export function setSellerCeiling(userId: string, maxDiscountPercent: number) {
  return apiFetch<SellerCeiling[]>('/distributor/sellers/ceiling', {
    method: 'POST',
    body: JSON.stringify({ userId, maxDiscountPercent }),
  });
}

export function listQuotes() {
  return apiFetch<DistributorQuote[]>('/distributor/quotes');
}

export function createQuote(input: {
  customerName: string;
  lines: Array<{
    variantId: string;
    quantity: number;
    unitPriceCents: number;
    discountPercent: number;
  }>;
}) {
  return apiFetch<DistributorQuote>('/distributor/quotes', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function approveQuote(quoteId: string) {
  return apiFetch<DistributorQuote>(`/distributor/quotes/${quoteId}/approve`, {
    method: 'POST',
  });
}

export function rejectQuote(quoteId: string) {
  return apiFetch<DistributorQuote>(`/distributor/quotes/${quoteId}/reject`, {
    method: 'POST',
  });
}

export function discountReport(from: string, to: string) {
  const query = new URLSearchParams({ from, to });
  return apiFetch<{
    from: string;
    to: string;
    grantedCents: number;
    quotes: DistributorQuote[];
  }>(`/distributor/quotes/discount-report?${query.toString()}`);
}

export function isDistributorManager(role: string) {
  return role === 'OWNER' || role === 'ADMIN';
}
