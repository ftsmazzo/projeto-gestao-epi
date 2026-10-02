import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { resolveApiFilesRoot } from '../workers/api-files-root';

export function getDistributorInboundRoot(): string {
  return resolveApiFilesRoot(
    'distributor-inbound',
    process.env.DISTRIBUTOR_INBOUND_DIR,
  );
}

export async function saveDistributorInboundFile(input: {
  organizationId: string;
  buffer: Buffer;
  mimeType?: string;
  originalName?: string;
}): Promise<{ relativePath: string; fileName: string; mimeType: string }> {
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

  const root = getDistributorInboundRoot();
  const dir = join(root, input.organizationId);
  await mkdir(dir, { recursive: true });
  const fileName = `${Date.now()}-${randomUUID()}.${ext}`;
  await writeFile(join(dir, fileName), input.buffer);

  return {
    relativePath: `${input.organizationId}/${fileName}`,
    fileName: input.originalName?.trim() || fileName,
    mimeType,
  };
}
