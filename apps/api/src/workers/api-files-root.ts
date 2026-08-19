import { existsSync, mkdirSync, readdirSync, readFileSync } from 'fs';
import { dirname, isAbsolute, join } from 'path';

export type ApiFilesSubdir =
  | 'worker-face-references'
  | 'delivery-evidence'
  | 'invoice-documents'
  | 'org-logos'
  | 'client-logos'
  | 'sst-evidence'
  | 'training-assets';

/**
 * Sobe diretorios a partir deste modulo ate achar o package @gestao-epi/api.
 * Funciona em dist/workers e em src/workers.
 */
export function findApiPackageRoot(): string {
  let dir = __dirname;
  for (let i = 0; i < 8; i += 1) {
    const pkgPath = join(dir, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const raw = readFileSync(pkgPath, 'utf8');
        const pkg = JSON.parse(raw) as { name?: string };
        if (pkg.name === '@gestao-epi/api') {
          return dir;
        }
      } catch {
        // continua subindo
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

function envRoot(envValue?: string | null): string | null {
  const fromEnv = envValue?.trim();
  if (!fromEnv) return null;
  return isAbsolute(fromEnv) ? fromEnv : join(process.cwd(), fromEnv);
}

/**
 * Lista de raizes candidatas (primaria primeiro) para achar arquivos legados.
 */
export function listApiFilesRootCandidates(
  subdir: ApiFilesSubdir,
  envValue?: string | null,
): string[] {
  const apiRoot = findApiPackageRoot();
  const list = [
    envRoot(envValue),
    join(apiRoot, 'files', subdir),
    join(process.cwd(), 'files', subdir),
    join(process.cwd(), 'apps', 'api', 'files', subdir),
    join('/app', 'files', subdir),
    join('/data', 'files', subdir),
  ].filter((v): v is string => Boolean(v));

  return [...new Set(list)];
}

function persistentFilesParent(): string | null {
  if (existsSync('/app/files')) return '/app/files';
  return null;
}

/**
 * Resolve raiz canonica de escrita.
 * Preferencia: env → /app/files/{subdir} em producao → pasta legada com conteudo.
 */
export function resolveApiFilesRoot(
  subdir: ApiFilesSubdir,
  envValue?: string | null,
): string {
  const fromEnv = envRoot(envValue);
  if (fromEnv) {
    mkdirSync(fromEnv, { recursive: true });
    return fromEnv;
  }

  const parent = persistentFilesParent();
  const preferred = parent
    ? join(parent, subdir)
    : join(findApiPackageRoot(), 'files', subdir);
  const candidates = listApiFilesRootCandidates(subdir, envValue);

  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;
    try {
      if (readdirSync(candidate).length > 0) {
        mkdirSync(candidate, { recursive: true });
        return candidate;
      }
    } catch {
      // ignore
    }
  }

  mkdirSync(preferred, { recursive: true });
  return preferred;
}
