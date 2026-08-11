import pdfParse from 'pdf-parse';

export type InvoiceExtractedLine = {
  description: string;
  quantity: number | null;
  unitCostCents: number | null;
  totalCostCents: number | null;
  caNumber: string | null;
  confidence: 'high' | 'medium' | 'low';
};

export type InvoiceExtractionResult = {
  method: 'PDF_TEXT' | 'OPENAI_VISION' | 'NONE';
  ok: boolean;
  message: string;
  invoiceNumber: string | null;
  supplierName: string | null;
  lines: InvoiceExtractedLine[];
  /** Melhor chute unico para preencher entrada (1 linha ou maior total). */
  suggested: {
    quantity: number | null;
    unitCostCents: number | null;
    totalCostCents: number | null;
    description: string | null;
  } | null;
  rawTextPreview: string | null;
};

const MONEY_RE = /(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}|\d+\.\d{2})/g;
const CA_RE = /\b(?:CA[\s./-]*)?(\d{4,6})\b/gi;

export function parseMoneyToCents(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const normalized = t.includes(',')
    ? t.replace(/\./g, '').replace(',', '.')
    : t;
  const n = Number(normalized);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

function extractInvoiceNumber(text: string): string | null {
  const patterns = [
    /n[ºo°.]?\s*(?:da\s*)?nota[:\s]*(\d{3,12})/i,
    /n[úu]mero[:\s]*(\d{3,12})/i,
    /\bnf[\s-]*e?[:\s]*(\d{3,12})/i,
    /\bnfe[:\s]*(\d{3,12})/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}

function extractSupplierName(text: string): string | null {
  const m =
    text.match(/emitente[:\s]+([^\n]{3,80})/i) ||
    text.match(/razao\s*social[:\s]+([^\n]{3,80})/i) ||
    text.match(/fornecedor[:\s]+([^\n]{3,80})/i);
  if (!m?.[1]) return null;
  return m[1].replace(/\s+/g, ' ').trim().slice(0, 120);
}

function findCaInLine(line: string): string | null {
  const matches = [...line.matchAll(CA_RE)];
  for (const m of matches) {
    const n = m[1];
    // evita anos / CEP curtos: CA tipico 5-6 digitos; aceita 4+
    if (n.length >= 4 && n.length <= 6) return n;
  }
  return null;
}

/**
 * Heuristica para texto de NF-e / DANFE / pedido.
 * Nao cobre todos os layouts; sugere linhas com qtd + valor.
 */
export function parseInvoiceText(text: string): InvoiceExtractionResult {
  const cleaned = text.replace(/\r/g, '\n').replace(/[ \t]+/g, ' ').trim();
  if (!cleaned || cleaned.length < 20) {
    return {
      method: 'PDF_TEXT',
      ok: false,
      message: 'PDF sem texto legivel (pode ser imagem escaneada).',
      invoiceNumber: null,
      supplierName: null,
      lines: [],
      suggested: null,
      rawTextPreview: cleaned.slice(0, 400) || null,
    };
  }

  const lines: InvoiceExtractedLine[] = [];
  const rawLines = cleaned.split('\n').map((l) => l.trim()).filter(Boolean);

  for (const line of rawLines) {
    if (line.length < 8 || line.length > 220) continue;
    if (/^(total|imposto|icms|ipi|cfop|chave|protocolo|pagina)/i.test(line)) {
      continue;
    }

    const moneyMatches = [...line.matchAll(MONEY_RE)].map((m) => m[1]);
    if (moneyMatches.length === 0) continue;

    const amounts = moneyMatches
      .map(parseMoneyToCents)
      .filter((v): v is number => v != null && v > 0);
    if (amounts.length === 0) continue;

    // Quantidade: inteiro isolado antes dos valores (ex.: ... 10 12,50 125,00)
    let quantity: number | null = null;
    const qtyMatch = line.match(
      /(?:qtd[e.]?|quant(?:idade)?|qtde)[:\s]*(\d+(?:[.,]\d+)?)/i,
    );
    if (qtyMatch?.[1]) {
      quantity = Math.max(1, Math.round(Number(qtyMatch[1].replace(',', '.'))));
    } else {
      const beforeMoney = line
        .slice(0, line.indexOf(moneyMatches[0]))
        .match(/(?:^|\s)(\d{1,4})(?:\s|$)/g);
      if (beforeMoney?.length) {
        const last = beforeMoney[beforeMoney.length - 1].trim();
        const q = Number(last);
        if (Number.isInteger(q) && q >= 1 && q <= 9999) quantity = q;
      }
    }

    let unitCostCents: number | null = null;
    let totalCostCents: number | null = null;

    if (amounts.length === 1) {
      unitCostCents = amounts[0];
      if (quantity != null) totalCostCents = unitCostCents * quantity;
    } else if (amounts.length >= 2) {
      // tipico: unitario + total (ultimo = total)
      unitCostCents = amounts[amounts.length - 2];
      totalCostCents = amounts[amounts.length - 1];
      if (
        quantity == null &&
        unitCostCents > 0 &&
        totalCostCents >= unitCostCents
      ) {
        const inferred = Math.round(totalCostCents / unitCostCents);
        if (inferred >= 1 && inferred <= 9999) quantity = inferred;
      }
      // se unit * qtd != total, preferir unitario e recalcular
      if (
        quantity != null &&
        unitCostCents != null &&
        Math.abs(unitCostCents * quantity - totalCostCents) >
          Math.max(100, unitCostCents * 0.05)
      ) {
        // manter ambos; UI pode escolher
      }
    }

    const description = line
      .replace(MONEY_RE, ' ')
      .replace(/\b\d{1,4}\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 160);

    if (!description || description.length < 3) continue;
    if (/valor\s*total|desconto|frete|outras\s*despesas/i.test(description)) {
      continue;
    }

    const confidence: InvoiceExtractedLine['confidence'] =
      quantity != null && unitCostCents != null
        ? 'high'
        : unitCostCents != null
          ? 'medium'
          : 'low';

    lines.push({
      description,
      quantity,
      unitCostCents,
      totalCostCents,
      caNumber: findCaInLine(line),
      confidence,
    });
  }

  // Dedup grosseiro por descricao+preco
  const deduped: InvoiceExtractedLine[] = [];
  const seen = new Set<string>();
  for (const row of lines) {
    const key = `${row.description.toLowerCase()}|${row.unitCostCents}|${row.quantity}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(row);
  }

  const ranked = [...deduped].sort((a, b) => {
    const score = (x: InvoiceExtractedLine) =>
      (x.confidence === 'high' ? 3 : x.confidence === 'medium' ? 2 : 1) +
      (x.totalCostCents ?? 0) / 1_000_000;
    return score(b) - score(a);
  });

  const best = ranked[0] ?? null;
  const suggested = best
    ? {
        quantity: best.quantity,
        unitCostCents: best.unitCostCents,
        totalCostCents: best.totalCostCents,
        description: best.description,
      }
    : null;

  return {
    method: 'PDF_TEXT',
    ok: ranked.length > 0,
    message:
      ranked.length > 0
        ? `Encontramos ${ranked.length} linha(s) com valor. Confira antes de usar.`
        : 'Nao achamos linhas com quantidade/valor no texto da nota.',
    invoiceNumber: extractInvoiceNumber(cleaned),
    supplierName: extractSupplierName(cleaned),
    lines: ranked.slice(0, 40),
    suggested,
    rawTextPreview: cleaned.slice(0, 500),
  };
}

export async function extractTextFromPdfBuffer(
  buffer: Buffer,
): Promise<string> {
  const parsed = await pdfParse(buffer);
  return parsed.text ?? '';
}

type VisionLine = {
  description?: string;
  quantity?: number | null;
  unitCostReais?: number | null;
  totalCostReais?: number | null;
  caNumber?: string | null;
};

/**
 * Extracao via OpenAI Vision quando OPENAI_API_KEY estiver configurada.
 */
export async function extractInvoiceWithOpenAiVision(input: {
  buffer: Buffer;
  mimeType: string;
}): Promise<InvoiceExtractionResult | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const mime = input.mimeType || 'image/jpeg';
  if (!mime.startsWith('image/') && !mime.includes('pdf')) {
    return null;
  }
  // Vision tipicamente para imagens; PDF enviado como image so se for imagem.
  if (mime.includes('pdf')) {
    return null;
  }

  const b64 = input.buffer.toString('base64');
  const dataUrl = `data:${mime};base64,${b64}`;

  const body = {
    model: process.env.OPENAI_VISION_MODEL?.trim() || 'gpt-4o-mini',
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'Voce extrai itens de nota fiscal brasileira. Responda so JSON valido.',
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Extraia da nota fiscal (ou cupom) os itens com descricao, quantidade, valor unitario e total em reais.
Tambem numero da nota e fornecedor se visiveis.
JSON no formato:
{"invoiceNumber":string|null,"supplierName":string|null,"lines":[{"description":string,"quantity":number|null,"unitCostReais":number|null,"totalCostReais":number|null,"caNumber":string|null}]}`,
          },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ],
  };

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    return {
      method: 'OPENAI_VISION',
      ok: false,
      message: `Falha na leitura por IA (${res.status}). ${errText.slice(0, 180)}`,
      invoiceNumber: null,
      supplierName: null,
      lines: [],
      suggested: null,
      rawTextPreview: null,
    };
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content ?? '{}';
  let parsed: {
    invoiceNumber?: string | null;
    supplierName?: string | null;
    lines?: VisionLine[];
  };
  try {
    parsed = JSON.parse(content) as typeof parsed;
  } catch {
    return {
      method: 'OPENAI_VISION',
      ok: false,
      message: 'IA retornou JSON invalido.',
      invoiceNumber: null,
      supplierName: null,
      lines: [],
      suggested: null,
      rawTextPreview: content.slice(0, 400),
    };
  }

  const lines: InvoiceExtractedLine[] = (parsed.lines ?? [])
    .map((row) => {
      const unitCostCents =
        row.unitCostReais != null
          ? Math.round(Number(row.unitCostReais) * 100)
          : null;
      const totalCostCents =
        row.totalCostReais != null
          ? Math.round(Number(row.totalCostReais) * 100)
          : null;
      const quantity =
        row.quantity != null && Number.isFinite(Number(row.quantity))
          ? Math.max(1, Math.round(Number(row.quantity)))
          : null;
      const description = (row.description || '').trim().slice(0, 160);
      if (!description) return null;
      return {
        description,
        quantity,
        unitCostCents:
          unitCostCents != null && unitCostCents >= 0 ? unitCostCents : null,
        totalCostCents:
          totalCostCents != null && totalCostCents >= 0 ? totalCostCents : null,
        caNumber: row.caNumber?.replace(/\D/g, '') || null,
        confidence:
          quantity != null && unitCostCents != null
            ? ('high' as const)
            : unitCostCents != null
              ? ('medium' as const)
              : ('low' as const),
      };
    })
    .filter((v): v is InvoiceExtractedLine => v != null);

  const best = lines[0] ?? null;
  return {
    method: 'OPENAI_VISION',
    ok: lines.length > 0,
    message:
      lines.length > 0
        ? `IA leu ${lines.length} item(ns). Confira antes de usar.`
        : 'IA nao encontrou itens com valor na imagem.',
    invoiceNumber: parsed.invoiceNumber?.trim() || null,
    supplierName: parsed.supplierName?.trim() || null,
    lines: lines.slice(0, 40),
    suggested: best
      ? {
          quantity: best.quantity,
          unitCostCents: best.unitCostCents,
          totalCostCents: best.totalCostCents,
          description: best.description,
        }
      : null,
    rawTextPreview: null,
  };
}

export async function extractInvoiceFromFile(input: {
  buffer: Buffer;
  mimeType: string;
  originalName?: string;
}): Promise<InvoiceExtractionResult> {
  const mime = (input.mimeType || '').toLowerCase();
  const name = (input.originalName || '').toLowerCase();
  const isPdf = mime.includes('pdf') || name.endsWith('.pdf');
  const isImage =
    mime.startsWith('image/') ||
    /\.(jpe?g|png|webp)$/i.test(name);

  if (isPdf) {
    try {
      const text = await extractTextFromPdfBuffer(input.buffer);
      const fromText = parseInvoiceText(text);
      if (fromText.ok) return fromText;
      // PDF escaneado / sem texto: tenta Vision nao aplica em PDF binario aqui
      return {
        ...fromText,
        message:
          fromText.message +
          ' Para foto/scan, envie JPG/PNG ou configure OPENAI_API_KEY.',
      };
    } catch (err) {
      return {
        method: 'PDF_TEXT',
        ok: false,
        message:
          err instanceof Error
            ? `Falha ao ler PDF: ${err.message}`
            : 'Falha ao ler PDF.',
        invoiceNumber: null,
        supplierName: null,
        lines: [],
        suggested: null,
        rawTextPreview: null,
      };
    }
  }

  if (isImage) {
    const vision = await extractInvoiceWithOpenAiVision({
      buffer: input.buffer,
      mimeType: mime || 'image/jpeg',
    });
    if (vision) return vision;
    return {
      method: 'NONE',
      ok: false,
      message:
        'Imagem anexada. Para ler valores automaticamente, configure OPENAI_API_KEY na API (Vision). PDF com texto funciona sem chave.',
      invoiceNumber: null,
      supplierName: null,
      lines: [],
      suggested: null,
      rawTextPreview: null,
    };
  }

  return {
    method: 'NONE',
    ok: false,
    message: 'Formato nao suportado para extracao.',
    invoiceNumber: null,
    supplierName: null,
    lines: [],
    suggested: null,
    rawTextPreview: null,
  };
}
