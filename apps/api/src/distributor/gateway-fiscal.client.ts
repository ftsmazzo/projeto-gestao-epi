import { Injectable, Logger } from '@nestjs/common';

export type GatewayEmitPayload = {
  externalId: string;
  destinatario: Record<string, unknown>;
  itens: Array<Record<string, unknown>>;
  totais?: Record<string, unknown>;
};

export type GatewayNfeStatus = {
  id: string;
  status: string;
  serie: number | null;
  numero: number | null;
  chaveAcesso: string | null;
  protocolo: string | null;
  rejectionCode: string | null;
  rejectionMsg: string | null;
  externalId: string | null;
};

@Injectable()
export class GatewayFiscalClient {
  private readonly logger = new Logger(GatewayFiscalClient.name);

  isConfigured(): boolean {
    return Boolean(this.baseUrl() && this.apiKey());
  }

  async emitNfe(payload: GatewayEmitPayload): Promise<{ id: string; status: string }> {
    const res = await this.request('/v1/nfe', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const json = (await res.json()) as { id?: string; status?: string; error?: string };
    if (!res.ok || !json.id) {
      throw new Error(json.error || `gateway emit failed (${res.status})`);
    }
    return { id: json.id, status: json.status || 'na_fila' };
  }

  async getNfeStatus(id: string): Promise<GatewayNfeStatus> {
    const res = await this.request(`/v1/nfe/${encodeURIComponent(id)}`, {
      method: 'GET',
    });
    const json = (await res.json()) as GatewayNfeStatus & { error?: string };
    if (!res.ok) {
      throw new Error(json.error || `gateway status failed (${res.status})`);
    }
    return json;
  }

  private baseUrl(): string {
    return (process.env.GATEWAY_FISCAL_BASE_URL ?? '').trim().replace(/\/$/, '');
  }

  private apiKey(): string {
    return (process.env.GATEWAY_FISCAL_API_KEY ?? '').trim();
  }

  private timeoutMs(): number {
    const raw = Number(process.env.GATEWAY_FISCAL_TIMEOUT_MS ?? 15000);
    return Number.isFinite(raw) && raw > 0 ? raw : 15000;
  }

  private async request(path: string, init: RequestInit): Promise<Response> {
    const base = this.baseUrl();
    const key = this.apiKey();
    if (!base || !key) {
      throw new Error(
        'Gateway Fiscal nao configurado (GATEWAY_FISCAL_BASE_URL / GATEWAY_FISCAL_API_KEY).',
      );
    }
    this.logger.log(`Gateway Fiscal ${init.method} ${path}`);
    return fetch(`${base}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${key}`,
        'content-type': 'application/json',
        ...(init.headers || {}),
      },
      signal: AbortSignal.timeout(this.timeoutMs()),
    });
  }
}
