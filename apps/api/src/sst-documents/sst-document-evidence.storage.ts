import { createHash, randomUUID } from 'crypto';
import { existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { resolveApiFilesRoot } from '../workers/api-files-root';
import { resolveInsideRoot } from '../workers/biometric-storage-path';

export function getSstEvidenceRoot(): string {
  return resolveApiFilesRoot('sst-evidence', process.env.SST_EVIDENCE_DIR);
}

export async function saveSstEvidenceFile(input: {
  organizationId: string;
  documentId: string;
  buffer: Buffer;
  mimeType?: string;
}) {
  const mimeType = input.mimeType?.trim() || 'image/jpeg';
  const ext = mimeType.includes('png')
    ? 'png'
    : mimeType.includes('webp')
      ? 'webp'
      : 'jpg';
  const root = getSstEvidenceRoot();
  const dir = join(root, input.organizationId);
  await mkdir(dir, { recursive: true });
  const fileName = `${input.documentId}-${randomUUID()}.${ext}`;
  const absolutePath = join(dir, fileName);
  await writeFile(absolutePath, input.buffer);
  if (!existsSync(absolutePath)) {
    throw new Error('Evidencia facial do documento SST nao persistiu.');
  }
  return {
    relativePath: `${input.organizationId}/${fileName}`,
    absolutePath,
    fileHash: createHash('sha256').update(input.buffer).digest('hex'),
    mimeType,
    byteSize: input.buffer.length,
  };
}

export function resolveSstEvidenceAbsolutePath(relativePath: string): string {
  return resolveInsideRoot(getSstEvidenceRoot(), relativePath);
}

export function tryResolveSstEvidenceAbsolutePath(
  relativePath: string | null | undefined,
): string | null {
  if (!relativePath?.trim()) return null;
  try {
    const absolute = resolveSstEvidenceAbsolutePath(relativePath);
    return existsSync(absolute) ? absolute : null;
  } catch {
    return null;
  }
}
