import pdfParse from 'pdf-parse';

export type CatalogQuoteItem = {
  name: string;
  sizes: string[];
  supplierSku: string | null;
  gtin: string | null;
  ncm: string | null;
  costCents: number | null;
  salePriceCents: number | null;
  quantity: number | null;
  confidence: 'high' | 'medium' | 'low';
};

export type CatalogQuoteExtractResult = {
  ok: boolean;
  method: 'OPENROUTER_VISION' | 'OPENROUTER_TEXT' | 'NONE';
  message: string;
  supplierName: string | null;
  items: CatalogQuoteItem[];
  warnings: string[];
};

const IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text ? text : null;
}

function parseMoneyToCents(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) {
    // Modelo devolve reais (ex.: 19.9).
    return Math.round(raw * 100);
  }
  if (typeof raw !== 'string') return null;
  const text = raw.trim().replace(/[R$\s]/gi, '');
  if (!text) return null;
  const normalized = text.includes(',')
    ? text.replace(/\./g, '').replace(',', '.')
    : text;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

function parseQty(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    return Math.round(raw);
  }
  if (typeof raw !== 'string') return null;
  const value = Number(raw.trim().replace(/\./g, '').replace(',', '.'));
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value);
}

function splitSizes(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    const labels = raw
      .map((item) => asTrimmedString(item))
      .filter((item): item is string => Boolean(item));
    return labels.length > 0 ? uniqueSizes(labels) : ['Único'];
  }
  const text = asTrimmedString(raw);
  if (!text) return ['Único'];
  const parts = text
    .split(/[|;,/]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 0 ? uniqueSizes(parts) : ['Único'];
}

function uniqueSizes(labels: string[]): string[] {
  const out: string[] = [];
  for (const label of labels) {
    const exists = out.some(
      (item) => item.toLocaleLowerCase('pt-BR') === label.toLocaleLowerCase('pt-BR'),
    );
    if (!exists) out.push(label);
  }
  return out.length > 0 ? out : ['Único'];
}

function confidenceOf(raw: unknown): 'high' | 'medium' | 'low' {
  const text = asTrimmedString(raw)?.toLowerCase();
  if (text === 'high' || text === 'alta') return 'high';
  if (text === 'low' || text === 'baixa') return 'low';
  return 'medium';
}

function normalizeItem(raw: unknown): CatalogQuoteItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const name =
    asTrimmedString(row.name) ||
    asTrimmedString(row.produto) ||
    asTrimmedString(row.description) ||
    asTrimmedString(row.descricao);
  if (!name || name.length < 2) return null;
  return {
    name: name.slice(0, 180),
    sizes: splitSizes(row.sizes ?? row.tamanhos ?? row.tamanho),
    supplierSku:
      asTrimmedString(row.supplierSku) ||
      asTrimmedString(row.codigo) ||
      asTrimmedString(row.sku) ||
      null,
    gtin: asTrimmedString(row.gtin) || asTrimmedString(row.ean) || null,
    ncm: asTrimmedString(row.ncm),
    costCents:
      parseMoneyToCents(row.custo) ??
      parseMoneyToCents(row.costReais) ??
      parseMoneyToCents(row.unitCost) ??
      null,
    salePriceCents:
      parseMoneyToCents(row.preco) ??
      parseMoneyToCents(row.precoVenda) ??
      parseMoneyToCents(row.saleReais) ??
      parseMoneyToCents(row.unitPrice) ??
      null,
    quantity: parseQty(row.quantity ?? row.qtd ?? row.quantidade),
    confidence: confidenceOf(row.confidence),
  };
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() || trimmed;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new Error('Resposta da IA sem JSON.');
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

function resolveOpenRouter(): {
  endpoint: string;
  model: string;
  headers: Record<string, string>;
} | null {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) return null;
  const model =
    process.env.OPENROUTER_CATALOG_MODEL?.trim() ||
    process.env.OPENROUTER_PGR_MODEL_PDF?.trim() ||
    process.env.OPENROUTER_PGR_MODEL?.trim() ||
    'mistralai/mistral-small-3.2-24b-instruct';
  const endpoint =
    process.env.OPENROUTER_BASE_URL?.trim() ||
    'https://openrouter.ai/api/v1/chat/completions';
  const referer =
    process.env.PUBLIC_WEB_URL?.trim() ||
    process.env.CLIENT_PORTAL_URL?.trim() ||
    'https://prontepi.local';
  return {
    endpoint,
    model,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': referer,
      'X-Title': 'ProntEPI Catalog Quote Extractor',
    },
  };
}

const SYSTEM_PROMPT = `Voce le orcamentos, listas de preco, pedidos e fotos de catálogo de EPIs/distribuidora no Brasil.
Responda SOMENTE JSON valido no formato:
{
  "supplierName": string|null,
  "items": [{
    "name": string,
    "sizes": string[] (ex.: ["38","39","40"] ou ["Único"]),
    "supplierSku": string|null,
    "gtin": string|null,
    "ncm": string|null,
    "custo": number|string|null (preco de custo unitario em reais),
    "preco": number|string|null (preco de venda unitario em reais),
    "quantity": number|null,
    "confidence": "high"|"medium"|"low"
  }],
  "warnings": string[]
}
Ignore totais, impostos agregados, cabecalhos fiscais e rodapes. Cada linha de produto vira um item.
Se so houver um preco, use em "preco". Se o documento for compra/fornecedor, preferira "custo".`;

async function callOpenRouter(params: {
  userContent: Array<Record<string, unknown>>;
}): Promise<{ ok: true; raw: string; model: string } | { ok: false; message: string }> {
  const llm = resolveOpenRouter();
  if (!llm) {
    return {
      ok: false,
      message:
        'OPENROUTER_API_KEY nao configurada na API. Nao foi possivel ler PDF/foto.',
    };
  }
  const res = await fetch(llm.endpoint, {
    method: 'POST',
    headers: llm.headers,
    body: JSON.stringify({
      model: llm.model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: params.userContent },
      ],
    }),
  });
  if (!res.ok) {
    const errText = (await res.text().catch(() => '')).slice(0, 240);
    return {
      ok: false,
      message: `Falha no OpenRouter (${res.status}). ${errText}`,
    };
  }
  const payload = (await res.json()) as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  let raw = '';
  if (typeof content === 'string') raw = content;
  else if (Array.isArray(content)) {
    raw = content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'text' in part) {
          return String((part as { text?: unknown }).text ?? '');
        }
        return '';
      })
      .join('\n');
  }
  if (!raw.trim()) {
    return { ok: false, message: 'A IA nao devolveu conteudo util.' };
  }
  return { ok: true, raw, model: llm.model };
}

function parseModelPayload(raw: string): {
  items: CatalogQuoteItem[];
  supplierName: string | null;
  warnings: string[];
} {
  const parsed = extractJsonObject(raw) as Record<string, unknown>;
  const itemsRaw = Array.isArray(parsed.items) ? parsed.items : [];
  const items = itemsRaw
    .map((item) => normalizeItem(item))
    .filter((item): item is CatalogQuoteItem => Boolean(item));
  const warnings = Array.isArray(parsed.warnings)
    ? parsed.warnings
        .map((item) => asTrimmedString(item))
        .filter((item): item is string => Boolean(item))
    : [];
  return {
    items,
    supplierName: asTrimmedString(parsed.supplierName),
    warnings,
  };
}

export async function extractCatalogQuoteFromFile(input: {
  buffer: Buffer;
  mimeType: string;
  originalName: string;
}): Promise<CatalogQuoteExtractResult> {
  const mime = (input.mimeType || '').toLowerCase();
  const name = (input.originalName || '').toLowerCase();
  const isPdf = mime.includes('pdf') || name.endsWith('.pdf');
  const isImage =
    IMAGE_TYPES.has(mime) ||
    /\.(jpe?g|png|webp|gif)$/i.test(name);

  if (!isPdf && !isImage) {
    return {
      ok: false,
      method: 'NONE',
      message: 'Envie PDF ou foto (JPG/PNG/WebP) de orcamento/lista.',
      supplierName: null,
      items: [],
      warnings: [],
    };
  }

  if (isImage) {
    const dataUrl = `data:${mime || 'image/jpeg'};base64,${input.buffer.toString('base64')}`;
    const called = await callOpenRouter({
      userContent: [
        {
          type: 'text',
          text: 'Extraia os produtos deste orcamento/foto de catalogo.',
        },
        { type: 'image_url', image_url: { url: dataUrl } },
      ],
    });
    if (!called.ok) {
      return {
        ok: false,
        method: 'NONE',
        message: called.message,
        supplierName: null,
        items: [],
        warnings: [],
      };
    }
    try {
      const parsed = parseModelPayload(called.raw);
      return {
        ok: parsed.items.length > 0,
        method: 'OPENROUTER_VISION',
        message:
          parsed.items.length > 0
            ? `${parsed.items.length} item(ns) lidos da foto (${called.model}).`
            : 'A IA nao encontrou itens na foto.',
        supplierName: parsed.supplierName,
        items: parsed.items,
        warnings: parsed.warnings,
      };
    } catch (error) {
      return {
        ok: false,
        method: 'OPENROUTER_VISION',
        message:
          error instanceof Error
            ? error.message
            : 'Falha ao interpretar a resposta da IA.',
        supplierName: null,
        items: [],
        warnings: [],
      };
    }
  }

  // PDF: texto nativo primeiro; se fraco, envia o PDF em base64 para o modelo.
  let pdfText = '';
  try {
    const parsed = await pdfParse(input.buffer);
    pdfText = (parsed.text || '').replace(/\s+/g, ' ').trim();
  } catch {
    pdfText = '';
  }

  if (pdfText.length >= 80) {
    const called = await callOpenRouter({
      userContent: [
        {
          type: 'text',
          text: `Extraia os produtos deste orcamento/PDF.\n---\n${pdfText.slice(0, 24000)}`,
        },
      ],
    });
    if (!called.ok) {
      return {
        ok: false,
        method: 'NONE',
        message: called.message,
        supplierName: null,
        items: [],
        warnings: [],
      };
    }
    try {
      const parsed = parseModelPayload(called.raw);
      return {
        ok: parsed.items.length > 0,
        method: 'OPENROUTER_TEXT',
        message:
          parsed.items.length > 0
            ? `${parsed.items.length} item(ns) lidos do PDF (${called.model}).`
            : 'A IA nao encontrou itens no PDF.',
        supplierName: parsed.supplierName,
        items: parsed.items,
        warnings: parsed.warnings,
      };
    } catch (error) {
      return {
        ok: false,
        method: 'OPENROUTER_TEXT',
        message:
          error instanceof Error
            ? error.message
            : 'Falha ao interpretar a resposta da IA.',
        supplierName: null,
        items: [],
        warnings: [],
      };
    }
  }

  const dataUrl = `data:application/pdf;base64,${input.buffer.toString('base64')}`;
  const called = await callOpenRouter({
    userContent: [
      {
        type: 'text',
        text: 'PDF com pouco texto selecionavel (possivelmente escaneado). Extraia os produtos do documento.',
      },
      { type: 'image_url', image_url: { url: dataUrl } },
    ],
  });
  if (!called.ok) {
    return {
      ok: false,
      method: 'NONE',
      message: called.message,
      supplierName: null,
      items: [],
      warnings: ['PDF sem texto util; tentativa visual tambem falhou.'],
    };
  }
  try {
    const parsed = parseModelPayload(called.raw);
    return {
      ok: parsed.items.length > 0,
      method: 'OPENROUTER_VISION',
      message:
        parsed.items.length > 0
          ? `${parsed.items.length} item(ns) lidos do PDF escaneado (${called.model}).`
          : 'A IA nao encontrou itens no PDF.',
      supplierName: parsed.supplierName,
      items: parsed.items,
      warnings: [
        ...parsed.warnings,
        'PDF com pouco texto; leitura visual via OpenRouter.',
      ],
    };
  } catch (error) {
    return {
      ok: false,
      method: 'OPENROUTER_VISION',
      message:
        error instanceof Error
          ? error.message
          : 'Falha ao interpretar a resposta da IA.',
      supplierName: null,
      items: [],
      warnings: [],
    };
  }
}
