import { existsSync } from 'fs';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import {
  listApiFilesRootCandidates,
  resolveApiFilesRoot,
} from '../workers/api-files-root';
import { resolveInsideRoot } from '../workers/biometric-storage-path';

export function getOrgLogosRoot(): string {
  return resolveApiFilesRoot('org-logos', process.env.ORG_LOGOS_DIR);
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

export async function saveOrgLogoFile(input: {
  organizationId: string;
  buffer: Buffer;
  mimeType?: string;
  originalName?: string;
}) {
  const mimeType = input.mimeType?.trim() || 'image/png';
  const ext = extFromMime(mimeType, input.originalName);
  if (!ext) {
    throw new Error('Formato de logo invalido. Use PNG, JPG, WEBP ou SVG.');
  }

  const root = getOrgLogosRoot();
  await mkdir(root, { recursive: true });
  const fileName = `${input.organizationId}.${ext}`;
  const absolutePath = join(root, fileName);
  await writeFile(absolutePath, input.buffer);

  return {
    relativePath: fileName,
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

export function resolveOrgLogoAbsolutePath(
  relativePath?: string | null,
  organizationId?: string | null,
): string | null {
  const names: string[] = [];
  const push = (name: string) => {
    const safe = name.replace(/\\/g, '/').replace(/^\/+/, '');
    if (!safe || safe.includes('..') || safe.includes('/')) return;
    names.push(safe);
  };
  if (relativePath?.trim()) {
    push(relativePath.trim());
    const stem = relativePath.trim().replace(/\.[^.]+$/, '');
    for (const ext of ['png', 'jpg', 'jpeg', 'webp', 'svg']) {
      push(`${stem}.${ext}`);
    }
  }
  if (organizationId?.trim()) {
    for (const ext of ['png', 'jpg', 'jpeg', 'webp', 'svg']) {
      push(`${organizationId.trim()}.${ext}`);
    }
  }
  const unique = [...new Set(names)];
  const ordered = [
    ...unique.filter((name) => !/\.svg$/i.test(name)),
    ...unique.filter((name) => /\.svg$/i.test(name)),
  ];
  const candidates = listApiFilesRootCandidates(
    'org-logos',
    process.env.ORG_LOGOS_DIR,
  );
  for (const name of ordered) {
    for (const root of candidates) {
      try {
        const absolute = resolveInsideRoot(root, name);
        if (existsSync(absolute)) return absolute;
      } catch {
        // path invalido neste root
      }
    }
  }
  return null;
}

export async function deleteOrgLogoFile(relativePath: string | null | undefined) {
  if (!relativePath) return;
  const absolute = resolveOrgLogoAbsolutePath(relativePath);
  if (!absolute) return;
  try {
    await unlink(absolute);
  } catch {
    // arquivo ja ausente
  }
}
