import { existsSync } from 'fs';
import { isAbsolute, join } from 'path';

/**
 * Resolve raiz local de arquivos da API de forma estavel.
 * Preferencia: env absoluta/relativa → pasta ja existente → apps/api/files/{subdir}.
 */
export function resolveApiFilesRoot(
  subdir: 'worker-face-references' | 'delivery-evidence',
  envValue?: string | null,
): string {
  const fromEnv = envValue?.trim();
  if (fromEnv) {
    return isAbsolute(fromEnv) ? fromEnv : join(process.cwd(), fromEnv);
  }

  const candidates = [
    // Nest build: dist/workers|dist/portal → apps/api/files/...
    join(__dirname, '..', '..', 'files', subdir),
    // Execucao via ts-node a partir de src/...
    join(__dirname, '..', '..', '..', 'files', subdir),
    join(process.cwd(), 'files', subdir),
    join(process.cwd(), 'apps', 'api', 'files', subdir),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  // Default estavel relativo ao pacote compilado (apps/api/files/...).
  return join(__dirname, '..', '..', 'files', subdir);
}
