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
const FISCAL_NOISE_RE =
  /base\s*calc|total\s*(cbs|pis|cofins|ibs|nota|produtos|tribut)|inf\.\s*(fisco|contribuinte)|valor do (icms|ipi|frete|seguro)|v\.\s*(total|icms|tot|imp)|duplicata|fatura|peso\s*(bruto|l[ií]quido)|protocolo de autoriz|chave de acesso|consulta de autenticidade|natureza da opera|inscri[cç][aã]o estadual|destinat[aá]rio/i;

/** DANFE: NCM CST CFOP UN QTD UNITARIO TOTAL */
const DANFE_ITEM_RE =
  /(?:CA[:\s./-]*(\d{4,6})\s+)?(\d{8})\s+(\d{1,3}(?:\/\d{2,3})?)\s+(\d{4})\s+([A-Z]{2,4})\s+(\d{1,6}(?:[.,]\d{1,4})?)\s+(\d{1,6}(?:[.,]\d{1,4})?)\s+(\d{1,3}(?:\.\d{3})*,\d{2})/i;

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

function parseQty(raw: string): number | null {
  const n = Number(raw.trim().replace(/\./g, '').replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return null;
  const rounded = Math.round(n);
  if (rounded < 1 || rounded > 999_999) return null;
  return rounded;
}

function normalizeKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function extractInvoiceNumber(text: string): string | null {
  const dotted = text.match(/n[ºo°]\.?\s*(\d{1,3}(?:\.\d{3}){1,3})/i);
  if (dotted?.[1]) {
    const digits = dotted[1].replace(/\D/g, '').replace(/^0+/, '');
    if (digits.length >= 3 && digits.length <= 12) return digits;
  }
  const patterns = [
    /n[ºo°.]?\s*(?:da\s*)?nota[:\s]*(\d{3,12})/i,
    /n[úu]mero[:\s]*(\d{3,12})/i,
    /\bnf[\s-]*e?[:\s]*(\d{3,12})/i,
    /\bnfe[:\s]*(\d{3,12})/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1] && m[1].length <= 12) return m[1];
  }
  return null;
}

function extractSupplierName(text: string): string | null {
  const received = text.match(
    /RECEBEMOS DE\s+([A-ZÀ-Ÿ0-9][A-ZÀ-Ÿ0-9 .,&\-]{4,90}?)\s+OS PRODUTOS/i,
  );
  if (received?.[1]) {
    return received[1].replace(/\s+/g, ' ').trim().slice(0, 120);
  }
  const emit = text.match(
    /IDENTIFICA[CÇ][AÃ]O DO EMITENTE\s+([A-ZÀ-Ÿ0-9][^\n]{4,90})/i,
  );
  if (emit?.[1] && !/danfe|documento auxiliar/i.test(emit[1])) {
    return emit[1].replace(/\s+/g, ' ').trim().slice(0, 120);
  }
  const m =
    text.match(/emitente[:\s]+([^\n]{3,80})/i) ||
    text.match(/razao\s*social[:\s]+([^\n]{3,80})/i) ||
    text.match(/fornecedor[:\s]+([^\n]{3,80})/i);
  if (!m?.[1] || /destinat/i.test(m[1])) return null;
  return m[1].replace(/\s+/g, ' ').trim().slice(0, 120);
}

function findCaInLine(line: string): string | null {
  const labeled = line.match(/\bCA[\s./:-]*(\d{4,6})\b/i);
  if (labeled?.[1]) return labeled[1];
  return null;
}

function cleanProductDescription(raw: string): string {
  return raw
    .replace(/^\d{4,10}\s+/, '')
    .replace(/\bITEM\s*\d+\s*-?\s*/gi, '')
    .replace(/\bCA[\s./:-]*\d{4,6}\b/gi, '')
    .replace(/\b[A-Z]{1,3}\d{6,}\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
}

function amountsAgree(
  unitCostCents: number,
  quantity: number,
  totalCostCents: number,
): boolean {
  const expected = unitCostCents * quantity;
  const tol = Math.max(100, Math.round(unitCostCents * 0.02));
  return Math.abs(expected - totalCostCents) <= tol;
}

export function pickInvoiceLine(
  lines: InvoiceExtractedLine[],
  hint?: { caNumber?: string | null; description?: string | null },
): InvoiceExtractedLine | null {
  if (lines.length === 0) return null;
  const ca = hint?.caNumber?.replace(/\D/g, '') ?? '';
  if (ca) {
    const byCa = lines.find((line) => line.caNumber === ca);
    if (byCa) return byCa;
  }
  const hintKey = normalizeKey(hint?.description ?? '');
  const tokens = hintKey.split(' ').filter((token) => token.length >= 4);
  if (tokens.length > 0) {
    let best: InvoiceExtractedLine | null = null;
    let score = 0;
    for (const line of lines) {
      const desc = normalizeKey(line.description);
      const hit = tokens.filter(
        (token) => desc.includes(token) || token.includes(desc.split(' ')[0] ?? ''),
      ).length;
      if (hit > score) {
        score = hit;
        best = line;
      }
    }
    if (best && score > 0) return best;
  }
  return lines.find((line) => line.confidence === 'high') ?? lines[0];
}

function parseDanfeProductItems(text: string): InvoiceExtractedLine[] {
  const sectionMatch = text.match(
    /DADOS DOS PRODUTOS[\s\S]*?(?=DADOS ADICIONAIS|INFORMA[CÇ][OÕ]ES COMPLEMENTARES|$)/i,
  );
  const section = sectionMatch?.[0] ?? text;
  const rawLines = section
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const items: InvoiceExtractedLine[] = [];

  for (let i = 0; i < rawLines.length; i += 1) {
    const line = rawLines[i];
    const match = line.match(DANFE_ITEM_RE);
    if (!match) continue;
    const quantity = parseQty(match[6]);
    const unitCostCents = parseMoneyToCents(match[7]);
    const totalCostCents = parseMoneyToCents(match[8]);
    if (quantity == null || unitCostCents == null || totalCostCents == null) {
      continue;
    }
    if (!amountsAgree(unitCostCents, quantity, totalCostCents)) continue;

    let description = cleanProductDescription(line.slice(0, match.index ?? 0));
    if (description.length < 6 && i > 0) {
      description = cleanProductDescription(rawLines[i - 1]);
    }
    if (description.length < 3) continue;
    if (FISCAL_NOISE_RE.test(description)) continue;

    let caNumber: string | null = match[1] ?? findCaInLine(line);
    if (!caNumber && i > 0 && !DANFE_ITEM_RE.test(rawLines[i - 1])) {
      caNumber = findCaInLine(rawLines[i - 1]);
    }

    items.push({
      description,
      quantity,
      unitCostCents,
      totalCostCents,
      caNumber,
      confidence: 'high',
    });
  }
  return items;
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

  const danfeLines = parseDanfeProductItems(cleaned);
  const lines: InvoiceExtractedLine[] = [...danfeLines];

  if (danfeLines.length === 0) {
    const rawLines = cleaned.split('\n').map((l) => l.trim()).filter(Boolean);

    for (const line of rawLines) {
      if (line.length < 8 || line.length > 220) continue;
      if (FISCAL_NOISE_RE.test(line)) continue;
      if (/^(total|imposto|icms|ipi|cfop|chave|protocolo|pagina)/i.test(line)) {
        continue;
      }

      const moneyMatches = [...line.matchAll(MONEY_RE)].map((m) => m[1]);
      if (moneyMatches.length === 0 || moneyMatches.length > 3) continue;

      const amounts = moneyMatches
        .map(parseMoneyToCents)
        .filter((v): v is number => v != null && v > 0);
      if (amounts.length === 0) continue;

      let quantity: number | null = null;
      const qtyMatch = line.match(
        /(?:qtd[e.]?|quant(?:idade)?|qtde)[:\s]*(\d+(?:[.,]\d+)?)/i,
      );
      if (qtyMatch?.[1]) {
        quantity = parseQty(qtyMatch[1]);
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
      } else {
        unitCostCents = amounts[0];
        totalCostCents = amounts[amounts.length - 1];
        if (
          quantity == null &&
          unitCostCents > 0 &&
          totalCostCents >= unitCostCents
        ) {
          const inferred = Math.round(totalCostCents / unitCostCents);
          if (
            inferred >= 1 &&
            inferred <= 9999 &&
            amountsAgree(unitCostCents, inferred, totalCostCents)
          ) {
            quantity = inferred;
          }
        }
        if (
          quantity != null &&
          !amountsAgree(unitCostCents, quantity, totalCostCents)
        ) {
          continue;
        }
      }

      const description = cleanProductDescription(
        line
          .replace(MONEY_RE, ' ')
          .replace(/\b\d{1,4}\b/g, ' ')
          .replace(/\s+/g, ' ')
          .trim(),
      );

      if (!description || description.length < 3) continue;
      if (/valor\s*total|desconto|frete|outras\s*despesas/i.test(description)) {
        continue;
      }

      const confidence: InvoiceExtractedLine['confidence'] =
        quantity != null && unitCostCents != null && totalCostCents != null
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
  }

  const deduped: InvoiceExtractedLine[] = [];
  const seen = new Set<string>();
  for (const row of lines) {
    const key = `${row.description.toLowerCase()}|${row.unitCostCents}|${row.quantity}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(row);
  }

  const best = pickInvoiceLine(deduped);
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
    ok: deduped.length > 0,
    message:
      deduped.length > 0
        ? `Encontramos ${deduped.length} item(ns) na nota. Confira antes de usar.`
        : 'Nao achamos linhas com quantidade/valor no texto da nota.',
    invoiceNumber: extractInvoiceNumber(cleaned),
    supplierName: extractSupplierName(cleaned),
    lines: deduped.slice(0, 40),
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
