import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';

export type PgroDocumentKind = 'PDF' | 'DOCX';

export type PgroTextExtractResult = {
  kind: PgroDocumentKind;
  text: string;
};

function fileNameOf(file: Express.Multer.File): string {
  return (file.originalname || '').toLowerCase();
}

function mimeOf(file: Express.Multer.File): string {
  return (file.mimetype || '').toLowerCase();
}

/** Detecta PDF / DOCX. .doc legado e rejeitado com mensagem clara. */
export function detectPgroDocumentKind(
  file: Express.Multer.File,
): PgroDocumentKind {
  const name = fileNameOf(file);
  const mime = mimeOf(file);

  if (name.endsWith('.doc') && !name.endsWith('.docx')) {
    throw new Error(
      'Arquivo .doc (Word antigo) nao e suportado. Abra no Word e salve como .docx, ou envie o PDF.',
    );
  }

  const isDocx =
    name.endsWith('.docx') ||
    mime.includes(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ) ||
    mime === 'application/docx';

  if (isDocx) return 'DOCX';

  const isPdf = name.endsWith('.pdf') || mime.includes('pdf');
  if (isPdf) return 'PDF';

  throw new Error(
    'Formato nao suportado. Envie o PGR em Word (.docx) — preferencial — ou PDF.',
  );
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

/** HTML do Word → texto com quebras (essencial para achar GHE/APRHO). */
export function htmlToStructuredText(html: string): string {
  let value = html
    .replace(/\r/g, '\n')
    .replace(/<\/(p|h[1-6]|li|div|tr|table|section|article)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/t[dh]>/gi, '\t')
    .replace(/<[^>]+>/g, ' ');
  value = decodeHtmlEntities(value);
  return value
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function countGheMarkers(text: string): number {
  const a = (text.match(/Caracteriza[cç][aã]o\s+do\s+GHE\s*\d+/gi) ?? [])
    .length;
  const b = (text.match(/APRHO\s+do\s+GHE\s*\d+/gi) ?? []).length;
  const c = (text.match(/\bGHE\s*0*\d+\b/gi) ?? []).length;
  return a * 3 + b * 2 + c;
}

/**
 * Extrai texto do .docx priorizando estrutura (tabelas/paragrafos).
 * rawText sozinho cola celulas e derruba o parser de GHE.
 */
export async function extractDocxText(buffer: Buffer): Promise<string> {
  const [htmlResult, rawResult] = await Promise.all([
    mammoth.convertToHtml({ buffer }),
    mammoth.extractRawText({ buffer }),
  ]);
  const fromHtml = htmlToStructuredText(htmlResult.value ?? '');
  const fromRaw = (rawResult.value ?? '').trim();

  if (!fromHtml && !fromRaw) {
    throw new Error(
      'Nao foi possivel extrair texto do Word (.docx). Verifique se o arquivo nao esta vazio ou protegido.',
    );
  }
  if (!fromHtml) return fromRaw;
  if (!fromRaw) return fromHtml;

  const scoreHtml = countGheMarkers(fromHtml);
  const scoreRaw = countGheMarkers(fromRaw);
  if (scoreHtml !== scoreRaw) {
    return scoreHtml > scoreRaw ? fromHtml : fromRaw;
  }
  // Empate: HTML costuma preservar melhor as quebras de tabela.
  return fromHtml.length >= fromRaw.length * 0.8 ? fromHtml : fromRaw;
}

export async function extractPgroDocumentText(
  file: Express.Multer.File,
): Promise<PgroTextExtractResult> {
  const kind = detectPgroDocumentKind(file);

  if (kind === 'DOCX') {
    const text = await extractDocxText(file.buffer);
    return { kind, text };
  }

  const parsed = await pdfParse(file.buffer);
  return { kind: 'PDF', text: parsed.text ?? '' };
}
