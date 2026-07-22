/** Configuracao operacional da sincronizacao CAEPI (env). */

export const CAEPI_DEFAULT_SYNC_CRON = '0 3 1 * *';

export type CaepiRuntimeConfig = {
  sourceUrl: string | null;
  autoSyncEnabled: boolean;
  syncCron: string;
};

export function readCaepiRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env,
): CaepiRuntimeConfig {
  const sourceUrl = (env.CAEPI_SOURCE_URL ?? '').trim() || null;
  const autoSyncEnabled =
    (env.CAEPI_AUTO_SYNC_ENABLED ?? '').trim().toLowerCase() === 'true';
  const syncCron =
    (env.CAEPI_SYNC_CRON ?? '').trim() || CAEPI_DEFAULT_SYNC_CRON;

  return {
    sourceUrl,
    autoSyncEnabled,
    syncCron,
  };
}

export function assertCaepiSourceUrlConfigured(sourceUrl: string | null): string {
  if (!sourceUrl) {
    throw new Error(
      'CAEPI_SOURCE_URL nao configurada. Defina a URL oficial baixavel da base CAEPI no ambiente da API.',
    );
  }
  return sourceUrl;
}
