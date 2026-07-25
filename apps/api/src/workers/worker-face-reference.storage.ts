import { createHash, randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { isAbsolute, join } from 'path';

/**
 * Raiz do storage de referencia facial do trabalhador.
 * Preferir WORKER_FACE_REFERENCE_DIR (ex.: /app/files/worker-face-references).
 * Fallback local: {cwd}/files/worker-face-references
 */
export function getWorkerFaceReferenceRoot(): string {
  const fromEnv = process.env.WORKER_FACE_REFERENCE_DIR?.trim();
  if (fromEnv) {
    return isAbsolute(fromEnv) ? fromEnv : join(process.cwd(), fromEnv);
  }
  return join(process.cwd(), 'files', 'worker-face-references');
}

export type SavedWorkerFaceReference = {
  /** Caminho relativo a getWorkerFaceReferenceRoot() */
  relativePath: string;
  absolutePath: string;
  fileHash: string;
  mimeType: string;
  byteSize: number;
};

/**
 * Persiste foto de referencia facial em storage local privado.
 * Nao e reconhecimento biometrico — apenas referencia visual para conferencia humana.
 */
export async function saveWorkerFaceReferenceFile(input: {
  organizationId: string;
  workerId: string;
  buffer: Buffer;
  mimeType?: string;
}): Promise<SavedWorkerFaceReference> {
  const mimeType = input.mimeType?.trim() || 'image/jpeg';
  const ext = mimeType.includes('png')
    ? 'png'
    : mimeType.includes('webp')
      ? 'webp'
      : 'jpg';

  const root = getWorkerFaceReferenceRoot();
  const dir = join(root, input.organizationId);
  await mkdir(dir, { recursive: true });

  const fileName = `${input.workerId}-${randomUUID()}.${ext}`;
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

/** Resolve caminho absoluto a partir do filePath gravado (sem path traversal). */
export function resolveWorkerFaceReferenceAbsolutePath(
  relativePath: string,
): string {
  const safe = relativePath.replace(/\\/g, '/').replace(/\.\./g, '');
  return join(getWorkerFaceReferenceRoot(), safe);
}
