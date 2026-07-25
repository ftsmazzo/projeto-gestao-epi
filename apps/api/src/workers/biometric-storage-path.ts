import { unlink } from 'fs/promises';
import { isAbsolute, join, normalize, resolve, sep } from 'path';

/**
 * Garante que o caminho resolvido fica dentro do root (anti path-traversal).
 * Nao retorna path em erros publicos.
 */
export function assertPathInsideRoot(rootDir: string, absolutePath: string): string {
  const root = resolve(rootDir);
  const target = resolve(absolutePath);
  const prefix = root.endsWith(sep) ? root : `${root}${sep}`;
  if (target !== root && !target.startsWith(prefix)) {
    throw new Error('Caminho de storage fora do diretorio permitido.');
  }
  return target;
}

/** Normaliza relative path relativo ao root, removendo `..`. */
export function sanitizeRelativeStoragePath(relativePath: string): string {
  const cleaned = relativePath.replace(/\\/g, '/').replace(/\.\./g, '');
  return cleaned
    .split('/')
    .filter((part) => part.length > 0 && part !== '.')
    .join('/');
}

/**
 * Remove arquivo se existir. Idempotente: ausente = sucesso.
 * Nunca inclui path completo na mensagem de erro.
 */
export async function safeUnlinkInsideRoot(
  rootDir: string,
  relativePath: string | null | undefined,
): Promise<'deleted' | 'missing' | 'skipped'> {
  if (!relativePath?.trim()) {
    return 'skipped';
  }
  const safeRelative = sanitizeRelativeStoragePath(relativePath.trim());
  if (!safeRelative) {
    return 'skipped';
  }
  const absolute = assertPathInsideRoot(
    rootDir,
    join(isAbsolute(rootDir) ? rootDir : resolve(rootDir), ...safeRelative.split('/')),
  );

  try {
    await unlink(absolute);
    return 'deleted';
  } catch (err) {
    const code =
      err && typeof err === 'object' && 'code' in err
        ? String((err as { code?: string }).code)
        : '';
    if (code === 'ENOENT') {
      return 'missing';
    }
    throw new Error('Falha ao remover arquivo biometrico do storage.');
  }
}

export function resolveInsideRoot(rootDir: string, relativePath: string): string {
  const safeRelative = sanitizeRelativeStoragePath(relativePath);
  const absolute = join(
    normalize(isAbsolute(rootDir) ? rootDir : resolve(rootDir)),
    ...safeRelative.split('/'),
  );
  return assertPathInsideRoot(rootDir, absolute);
}
