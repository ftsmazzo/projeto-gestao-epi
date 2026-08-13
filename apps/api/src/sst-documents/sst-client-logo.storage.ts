import { existsSync } from 'fs';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import {
  listApiFilesRootCandidates,
  resolveApiFilesRoot,
} from '../workers/api-files-root';
import {
  resolveInsideRoot,
  sanitizeRelativeStoragePath,
} from '../workers/biometric-storage-path';

export function getClientLogosRoot(): string {
  return resolveApiFilesRoot('client-logos', process.env.CLIENT_LOGOS_DIR);
}

function extFromMime(mimeType: string, originalName?: string) {
  const lower = (originalName || '').toLowerCase();
  if (mimeType.includes('png') || lower.endsWith('.png')) return 'png';
  if (mimeType.includes('webp') || lower.endsWith('.webp')) return 'webp';
  if (
    mimeType.includes('jpeg') ||
    mimeType.includes('jpg') ||
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg')
  ) {
    return 'jpg';
  }
  return null;
}

export async function saveClientLogoFile(input: {
  organizationId: string;
  servedClientId: string;
  buffer: Buffer;
  mimeType?: string;
  originalName?: string;
}) {
  const mimeType = input.mimeType?.trim() || 'image/png';
  const ext = extFromMime(mimeType, input.originalName);
  if (!ext) {
    throw new Error('Formato de logo invalido. Use PNG, JPG ou WEBP.');
  }
  const root = getClientLogosRoot();
  const dir = join(root, input.organizationId);
  await mkdir(dir, { recursive: true });
  const fileName = `${input.servedClientId}.${ext}`;
  const absolutePath = join(dir, fileName);
  await writeFile(absolutePath, input.buffer);
  return {
    relativePath: `${input.organizationId}/${fileName}`,
    absolutePath,
    mimeType:
      ext === 'jpg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png',
  };
}

export function resolveClientLogoAbsolutePath(
  relativePath: string,
): string | null {
  const safe = sanitizeRelativeStoragePath(relativePath);
  if (!safe) return null;
  const candidates = listApiFilesRootCandidates(
    'client-logos',
    process.env.CLIENT_LOGOS_DIR,
  );
  for (const root of candidates) {
    try {
      const absolute = resolveInsideRoot(root, safe);
      if (existsSync(absolute)) return absolute;
    } catch {
      // tenta o proximo root
    }
  }
  return null;
}

export async function deleteClientLogoFile(
  relativePath: string | null | undefined,
) {
  if (!relativePath) return;
  const absolute = resolveClientLogoAbsolutePath(relativePath);
  if (!absolute) return;
  try {
    await unlink(absolute);
  } catch {
    // arquivo ja ausente
  }
}
