import { createHash, randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { resolveApiFilesRoot } from '../workers/api-files-root';
import { resolveInsideRoot } from '../workers/biometric-storage-path';

/**
 * Raiz do storage de evidencia facial.
 * Preferir DELIVERY_EVIDENCE_DIR (ex.: /app/files/delivery-evidence no EasyPanel).
 * Fallback local estavel: apps/api/files/delivery-evidence
 */
export function getDeliveryEvidenceRoot(): string {
  return resolveApiFilesRoot(
    'delivery-evidence',
    process.env.DELIVERY_EVIDENCE_DIR,
  );
}

export type SavedFacialEvidence = {
  /**
   * Caminho relativo a getDeliveryEvidenceRoot()
   * (ex.: {organizationId}/{deliveryId}-{uuid}.jpg).
   */
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

  const root = getDeliveryEvidenceRoot();
  const dir = join(root, input.organizationId);
  await mkdir(dir, { recursive: true });

  const fileName = `${input.deliveryId}-${randomUUID()}.${ext}`;
  const absolutePath = join(dir, fileName);
  await writeFile(absolutePath, input.buffer);

  const relativePath = `${input.organizationId}/${fileName}`;

  return {
    relativePath,
    absolutePath,
    fileHash: createHash('sha256').update(input.buffer).digest('hex'),
    mimeType,
    byteSize: input.buffer.byteLength,
  };
}

/** Resolve caminho absoluto a partir do filePath gravado no banco (sem path traversal). */
export function resolveEvidenceAbsolutePath(relativePath: string): string {
  let safe = relativePath.replace(/\\/g, '/');
  // Compat com gravações anteriores: delivery-evidence/org/...
  if (safe.startsWith('delivery-evidence/')) {
    safe = safe.slice('delivery-evidence/'.length);
  }
  return resolveInsideRoot(getDeliveryEvidenceRoot(), safe);
}
