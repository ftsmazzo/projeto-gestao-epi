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

export async function extractPgroDocumentText(
  file: Express.Multer.File,
): Promise<PgroTextExtractResult> {
  const kind = detectPgroDocumentKind(file);

  if (kind === 'DOCX') {
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    const text = (result.value ?? '').trim();
    if (!text) {
      throw new Error(
        'Nao foi possivel extrair texto do Word (.docx). Verifique se o arquivo nao esta vazio ou protegido.',
      );
    }
    return { kind, text };
  }

  const parsed = await pdfParse(file.buffer);
  return { kind: 'PDF', text: parsed.text ?? '' };
}
