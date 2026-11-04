export type LeadApiCompany = {
  cnpj: string;
  razao_social: string | null;
  nome_fantasia: string | null;
  tipo_logradouro: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cep: string | null;
  uf: string | null;
  municipio: string | null;
  ddd1: string | null;
  telefone1: string | null;
  ddd2: string | null;
  telefone2: string | null;
  correio_eletronico: string | null;
  situacao_cadastral: string | null;
  situacao_cadastral_desc?: string | null;
};

export class LeadApiClientError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'LeadApiClientError';
  }
}

export function leadApiConfig() {
  const baseUrl = (process.env.LEAD_API_BASE_URL ?? '')
    .trim()
    .replace(/\/$/, '');
  const apiKey = (process.env.LEAD_API_KEY ?? '').trim();
  const timeoutMs = Number(process.env.LEAD_API_TIMEOUT_MS ?? 12000);
  return {
    baseUrl,
    apiKey,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 12000,
    configured: Boolean(baseUrl && apiKey),
  };
}

export async function fetchLeadByCnpj(
  cnpjDigits: string,
): Promise<LeadApiCompany> {
  const { baseUrl, apiKey, timeoutMs, configured } = leadApiConfig();
  if (!configured) {
    throw new LeadApiClientError(
      'Consulta CNPJ nao configurada (LEAD_API_BASE_URL / LEAD_API_KEY).',
      503,
    );
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(
      `${baseUrl}/v1/leads/${encodeURIComponent(cnpjDigits)}?socios=false`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'X-API-Key': apiKey,
        },
        signal: controller.signal,
      },
    );
    const body = (await res.json().catch(() => null)) as
      | LeadApiCompany
      | { detail?: string }
      | null;
    if (res.status === 404) {
      throw new LeadApiClientError('CNPJ nao encontrado na base.', 404);
    }
    if (!res.ok) {
      const detail =
        body && typeof body === 'object' && 'detail' in body
          ? String(body.detail ?? '')
          : '';
      throw new LeadApiClientError(
        detail || `Falha na consulta CNPJ (${res.status}).`,
        res.status,
      );
    }
    return body as LeadApiCompany;
  } catch (error) {
    if (error instanceof LeadApiClientError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new LeadApiClientError('Consulta CNPJ demorou demais.', 504);
    }
    throw new LeadApiClientError(
      error instanceof Error ? error.message : 'Falha na consulta CNPJ.',
      502,
    );
  } finally {
    clearTimeout(timer);
  }
}
