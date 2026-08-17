import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import WordExtractor from 'word-extractor';

export type PgroDocumentKind = 'PDF' | 'DOCX' | 'DOC';

export type PgroTextExtractResult = {
  kind: PgroDocumentKind;
  text: string;
  /** HTML bruto do Mammoth (DOCX) — remine tabular. */
  sourceHtml?: string | null;
};

function fileNameOf(file: Express.Multer.File): string {
  return (file.originalname || '').toLowerCase();
}

function mimeOf(file: Express.Multer.File): string {
  return (file.mimetype || '').toLowerCase();
}

function isZipBuffer(buffer: Buffer): boolean {
  return (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07)
  );
}

function isOleBuffer(buffer: Buffer): boolean {
  return (
    buffer.length >= 8 &&
    buffer[0] === 0xd0 &&
    buffer[1] === 0xcf &&
    buffer[2] === 0x11 &&
    buffer[3] === 0xe0
  );
}

function isLegacyDocName(name: string): boolean {
  return name.endsWith('.doc') && !name.endsWith('.docx');
}

/** Detecta PDF, DOCX e Word antigo (.doc). */
export function detectPgroDocumentKind(
  file: Express.Multer.File,
): PgroDocumentKind {
  const name = fileNameOf(file);
  const mime = mimeOf(file);

  const isDocx =
    name.endsWith('.docx') ||
    mime.includes(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ) ||
    mime === 'application/docx';

  if (isDocx) return 'DOCX';

  const isDoc =
    isLegacyDocName(name) ||
    mime === 'application/msword' ||
    mime.includes('application/msword');
  if (isDoc) return 'DOC';

  const isPdf = name.endsWith('.pdf') || mime.includes('pdf');
  if (isPdf) return 'PDF';

  throw new Error(
    'Formato nao suportado. Envie o PGR em Word (.doc ou .docx) ou PDF.',
  );
}

async function extractLegacyDocText(buffer: Buffer): Promise<string> {
  try {
    const extractor = new WordExtractor();
    const document = await extractor.extract(buffer);
    const body = document.getBody({ filterUnicode: false })?.trim() ?? '';
    const headers = document.getHeaders({ includeFooters: true })?.trim() ?? '';
    const textboxes = document.getTextboxes({ filterUnicode: false })?.trim() ?? '';
    const text = [headers, body, textboxes].filter(Boolean).join('\n');
    if (!text) {
      throw new Error('Arquivo .doc sem texto extraivel.');
    }
    return text;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Nao foi possivel ler o Word antigo (.doc). Se falhar, salve como .docx. Detalhe: ${detail}`,
    );
  }
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) =>
      String.fromCharCode(parseInt(h, 16)),
    );
}

/** Texto de uma celula: remove tags, unifica quebras internas em espaco. */
export function cellHtmlToText(cellHtml: string): string {
  let value = cellHtml
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
  value = decodeHtmlEntities(value);
  return value.replace(/\s+/g, ' ').trim();
}

/**
 * Converte HTML do Word em documento linear table-aware:
 * cada <tr> vira UMA linha com celulas separadas por TAB.
 * Nunca colapsa tabs em espaco.
 */
export function htmlToTableAwareText(html: string): string {
  let value = html.replace(/\r/g, '\n');

  value = value.replace(/<table\b[^>]*>[\s\S]*?<\/table>/gi, (tableHtml) => {
    const rows: string[] = [];
    const trRe = /<tr\b[^>]*>[\s\S]*?<\/tr>/gi;
    let trMatch: RegExpExecArray | null;
    while ((trMatch = trRe.exec(tableHtml)) != null) {
      const cells: string[] = [];
      const tdRe = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;
      let tdMatch: RegExpExecArray | null;
      while ((tdMatch = tdRe.exec(trMatch[0])) != null) {
        cells.push(cellHtmlToText(tdMatch[1]));
      }
      if (cells.some((c) => c.length > 0)) {
        rows.push(cells.join('\t'));
      }
    }
    return `\n${rows.join('\n')}\n`;
  });

  value = value
    .replace(/<\/(p|h[1-6]|li|div|section|article)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  value = decodeHtmlEntities(value);

  return value
    .replace(/[ ]+\n/g, '\n')
    .replace(/\n[ ]+/g, '\n')
    .replace(/[ ]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** @deprecated Preferir htmlToTableAwareText — mantido para testes legados. */
export function htmlToStructuredText(html: string): string {
  return htmlToTableAwareText(html).replace(/\t/g, ' ').replace(/[ ]{2,}/g, ' ');
}

function countGheMarkers(text: string): number {
  const a = (text.match(/Caracteriza[cç][aã]o\s+do\s+GHE\s*\d+/gi) ?? [])
    .length;
  const b = (text.match(/APRHO\s+do\s+GHE\s*\d+/gi) ?? []).length;
  const c = (text.match(/\bGHE\s*0*\d+\b/gi) ?? []).length;
  return a * 3 + b * 2 + c;
}

/**
 * Extrai texto do .docx priorizando tabelas (tr → linha com tabs).
 */
export async function extractDocxText(buffer: Buffer): Promise<string> {
  const extracted = await extractDocxDocument(buffer);
  return extracted.text;
}

export async function extractDocxDocument(buffer: Buffer): Promise<{
  text: string;
  html: string;
}> {
  const [htmlResult, rawResult] = await Promise.all([
    mammoth.convertToHtml({ buffer }),
    mammoth.extractRawText({ buffer }),
  ]);
  const html = htmlResult.value ?? '';
  const fromHtml = htmlToTableAwareText(html);
  const fromRaw = (rawResult.value ?? '').trim();

  if (!fromHtml && !fromRaw) {
    throw new Error(
      'Nao foi possivel extrair texto do Word. Verifique se o arquivo nao esta vazio ou protegido.',
    );
  }

  let text = fromHtml || fromRaw;
  if (fromHtml && fromRaw) {
    const scoreHtml = countGheMarkers(fromHtml);
    const scoreRaw = countGheMarkers(fromRaw);
    // Prefere HTML table-aware mesmo empatado — raw cola celulas.
    if (scoreRaw > scoreHtml * 1.2 && fromRaw.length > fromHtml.length * 1.5) {
      text = fromRaw;
    } else {
      text = fromHtml;
    }
  }

  return { text, html };
}

export async function extractPgroDocumentText(
  file: Express.Multer.File,
): Promise<PgroTextExtractResult> {
  const kind = detectPgroDocumentKind(file);
  const buffer = file.buffer;

  if (kind === 'DOCX' || (kind === 'DOC' && isZipBuffer(buffer))) {
    const { text, html } = await extractDocxDocument(buffer);
    return { kind: 'DOCX', text, sourceHtml: html };
  }

  if (kind === 'DOC') {
    if (!isOleBuffer(buffer) && !isZipBuffer(buffer)) {
      throw new Error(
        'Este .doc nao parece um arquivo Word valido. Tente salvar como .docx ou envie o PDF.',
      );
    }
    const text = await extractLegacyDocText(buffer);
    return { kind: 'DOC', text, sourceHtml: null };
  }

  const parsed = await pdfParse(buffer);
  return { kind: 'PDF', text: parsed.text ?? '', sourceHtml: null };
}
