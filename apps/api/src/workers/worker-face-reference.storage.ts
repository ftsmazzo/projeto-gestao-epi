import { createHash, randomUUID } from 'crypto';
import { existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import {
  listApiFilesRootCandidates,
  resolveApiFilesRoot,
} from './api-files-root';
import { resolveInsideRoot } from './biometric-storage-path';

/**
 * Raiz do storage de referencia facial do trabalhador.
 * Preferir WORKER_FACE_REFERENCE_DIR (ex.: /app/files/worker-face-references).
 * Fallback local estavel: apps/api/files/worker-face-references
 */
export function getWorkerFaceReferenceRoot(): string {
  return resolveApiFilesRoot(
    'worker-face-references',
    process.env.WORKER_FACE_REFERENCE_DIR,
  );
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

  if (!existsSync(absolutePath)) {
    throw new Error(
      'Falha critica: foto de referencia facial nao persistiu no storage.',
    );
  }

  const relativePath = `${input.organizationId}/${fileName}`;

  return {
    relativePath,
    absolutePath,
    fileHash: createHash('sha256').update(input.buffer).digest('hex'),
    mimeType,
    byteSize: input.buffer.byteLength,
  };
}

/** Resolve caminho absoluto; procura em raizes candidatas (legado). */
export function resolveWorkerFaceReferenceAbsolutePath(
  relativePath: string,
): string {
  const candidates = listApiFilesRootCandidates(
    'worker-face-references',
    process.env.WORKER_FACE_REFERENCE_DIR,
  );
  for (const root of candidates) {
    try {
      const absolute = resolveInsideRoot(root, relativePath);
      if (existsSync(absolute)) return absolute;
    } catch {
      // path invalido neste root
    }
  }
  return resolveInsideRoot(getWorkerFaceReferenceRoot(), relativePath);
}
