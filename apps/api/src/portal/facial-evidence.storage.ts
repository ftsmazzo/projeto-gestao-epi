import { createHash, randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

const EVIDENCE_ROOT = join(process.cwd(), 'files', 'delivery-evidence');

export type SavedFacialEvidence = {
  /** Caminho relativo a partir de files/ (ex.: delivery-evidence/org/xxx.jpg). */
  relativePath: string;
  absolutePath: string;
  fileHash: string;
  mimeType: string;
  byteSize: number;
};

/**
 * Persiste captura facial em storage local privado da API.
 * Pendencia: migrar para storage S3-compatible em etapa futura.
 */
export async function saveFacialEvidenceFile(input: {
  organizationId: string;
  deliveryId: string;
  buffer: Buffer;
  mimeType?: string;
}): Promise<SavedFacialEvidence> {
  const mimeType = input.mimeType?.trim() || 'image/jpeg';
  const ext =
    mimeType.includes('png')
      ? 'png'
      : mimeType.includes('webp')
        ? 'webp'
        : 'jpg';

  const dir = join(EVIDENCE_ROOT, input.organizationId);
  await mkdir(dir, { recursive: true });

  const fileName = `${input.deliveryId}-${randomUUID()}.${ext}`;
  const absolutePath = join(dir, fileName);
  await writeFile(absolutePath, input.buffer);

  const relativePath = join(
    'delivery-evidence',
    input.organizationId,
    fileName,
  ).replace(/\\/g, '/');

  return {
    relativePath,
    absolutePath,
    fileHash: createHash('sha256').update(input.buffer).digest('hex'),
    mimeType,
    byteSize: input.buffer.byteLength,
  };
}

export function resolveEvidenceAbsolutePath(relativePath: string): string {
  const safe = relativePath.replace(/\\/g, '/').replace(/\.\./g, '');
  return join(process.cwd(), 'files', safe);
}
