import { apiFetch, getAccessToken, getApiUrl } from './auth';

export type DistributorVariant = {
  id: string;
  label: string;
  quantity: number;
};

export type DistributorProduct = {
  id: string;
  name: string;
  internalSku: string;
  supplierSku: string | null;
  ncm: string | null;
  caNumber: string | null;
  minQuantity: number | null;
  variants: DistributorVariant[];
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
};

export type DistributorInboundLine = {
  id: string;
  description: string;
  quantity: number;
  unitCostCents: number | null;
  caNumber: string | null;
  variantId: string | null;
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

export function createDistributorProduct(input: {
  name: string;
  internalSku: string;
  supplierSku?: string;
  caNumber?: string;
  minQuantity?: number;
  variants: string[];
}) {
  return apiFetch<DistributorProduct>('/distributor/products', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateDistributorMin(productId: string, minQuantity: number | null) {
  return apiFetch<DistributorProduct>(`/distributor/products/${productId}`, {
    method: 'PATCH',
    body: JSON.stringify({ minQuantity }),
  });
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
}) {
  return apiFetch<{
    productName: string;
    label: string;
    balance: number;
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
) {
  return apiFetch<DistributorInboundDocument>(
    `/distributor/inbound/${documentId}/lines/${lineId}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ variantId }),
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

export function isDistributorManager(role: string) {
  return role === 'OWNER' || role === 'ADMIN';
}
