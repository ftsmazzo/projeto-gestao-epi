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

export function getTrainingAssetsRoot(): string {
  return resolveApiFilesRoot('training-assets', process.env.TRAINING_ASSETS_DIR);
}

function extFromMime(mimeType: string, originalName?: string) {
  const lower = (originalName || '').toLowerCase();
  if (mimeType.includes('png') || lower.endsWith('.png')) return 'png';
  if (mimeType.includes('webp') || lower.endsWith('.webp')) return 'webp';
  if (mimeType.includes('svg') || lower.endsWith('.svg')) return 'svg';
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

export async function saveTrainingAssetFile(input: {
  organizationId: string;
  templateId: string;
  kind: string;
  buffer: Buffer;
  mimeType?: string;
  originalName?: string;
}) {
  const mimeType = input.mimeType?.trim() || 'image/png';
  const ext = extFromMime(mimeType, input.originalName);
  if (!ext) {
    throw new Error('Formato invalido. Use PNG, JPG, WEBP ou SVG.');
  }
  const root = getTrainingAssetsRoot();
  const dir = join(root, input.organizationId, input.templateId);
  await mkdir(dir, { recursive: true });
  const fileName = `${input.kind.toLowerCase()}.${ext}`;
  const absolutePath = join(dir, fileName);
  await writeFile(absolutePath, input.buffer);
  return {
    relativePath: `${input.organizationId}/${input.templateId}/${fileName}`,
    absolutePath,
    mimeType:
      ext === 'svg'
        ? 'image/svg+xml'
        : ext === 'jpg'
          ? 'image/jpeg'
          : ext === 'webp'
            ? 'image/webp'
            : 'image/png',
  };
}

export function resolveTrainingAssetAbsolutePath(
  relativePath: string,
): string | null {
  const safe = sanitizeRelativeStoragePath(relativePath);
  if (!safe) return null;
  const candidates = listApiFilesRootCandidates(
    'training-assets',
    process.env.TRAINING_ASSETS_DIR,
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

export async function deleteTrainingAssetFile(
  relativePath: string | null | undefined,
) {
  if (!relativePath) return;
  const absolute = resolveTrainingAssetAbsolutePath(relativePath);
  if (!absolute) return;
  try {
    await unlink(absolute);
  } catch {
    // arquivo ja ausente
  }
}
