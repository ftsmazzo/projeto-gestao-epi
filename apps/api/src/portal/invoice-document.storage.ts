import { createHash, randomUUID } from 'crypto';
import { existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import {
  listApiFilesRootCandidates,
  resolveApiFilesRoot,
} from '../workers/api-files-root';
import { resolveInsideRoot } from '../workers/biometric-storage-path';

/**
 * Raiz do storage de notas fiscais / comprovantes.
 * Preferir INVOICE_DOCUMENTS_DIR; fallback: apps/api/files/invoice-documents
 */
export function getInvoiceDocumentsRoot(): string {
  return resolveApiFilesRoot(
    'invoice-documents',
    process.env.INVOICE_DOCUMENTS_DIR,
  );
}

export type SavedInvoiceDocument = {
  relativePath: string;
  absolutePath: string;
  fileHash: string;
  mimeType: string;
  byteSize: number;
};

function normalizeInvoiceRelativePath(relativePath: string): string {
  let safe = relativePath.replace(/\\/g, '/');
  if (safe.startsWith('invoice-documents/')) {
    safe = safe.slice('invoice-documents/'.length);
  }
  return safe;
}

export async function saveInvoiceDocumentFile(input: {
  organizationId: string;
  servedClientId: string;
  buffer: Buffer;
  mimeType?: string;
  originalName?: string;
}): Promise<SavedInvoiceDocument> {
  const mimeType = input.mimeType?.trim() || 'application/octet-stream';
  const lowerName = (input.originalName || '').toLowerCase();
  const ext =
    mimeType.includes('pdf') || lowerName.endsWith('.pdf')
      ? 'pdf'
      : mimeType.includes('png') || lowerName.endsWith('.png')
        ? 'png'
        : mimeType.includes('webp') || lowerName.endsWith('.webp')
          ? 'webp'
          : mimeType.includes('jpeg') ||
              mimeType.includes('jpg') ||
              lowerName.endsWith('.jpg') ||
              lowerName.endsWith('.jpeg')
            ? 'jpg'
            : 'bin';

  const root = getInvoiceDocumentsRoot();
  const dir = join(root, input.organizationId, input.servedClientId);
  await mkdir(dir, { recursive: true });

  const fileName = `${Date.now()}-${randomUUID()}.${ext}`;
  const absolutePath = join(dir, fileName);
  await writeFile(absolutePath, input.buffer);

  if (!existsSync(absolutePath)) {
    throw new Error(
      'Falha critica: documento de nota fiscal nao persistiu no storage.',
    );
  }

  const relativePath = `${input.organizationId}/${input.servedClientId}/${fileName}`;

  return {
    relativePath,
    absolutePath,
    fileHash: createHash('sha256').update(input.buffer).digest('hex'),
    mimeType,
    byteSize: input.buffer.byteLength,
  };
}

export function resolveInvoiceDocumentAbsolutePath(
  relativePath: string,
): string | null {
  const safe = normalizeInvoiceRelativePath(relativePath);
  const candidates = listApiFilesRootCandidates(
    'invoice-documents',
    process.env.INVOICE_DOCUMENTS_DIR,
  );
  for (const root of candidates) {
    try {
      const absolute = resolveInsideRoot(root, safe);
      if (existsSync(absolute)) return absolute;
    } catch {
      // path invalido neste root
    }
  }
  return null;
}
