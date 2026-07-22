/** Configuracao operacional da sincronizacao CAEPI (env). */

export const CAEPI_DEFAULT_SYNC_CRON = '0 3 1 * *';

/** Link baixavel gov.br (override tecnico opcional continua via CAEPI_SOURCE_URL). */
export const CAEPI_GOVBR_ZIP_URL =
  'https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/seguranca-e-saude-no-trabalho/equipamentos-de-protecao-individual-epi/tgg_export_caepi.zip/@@download/file';

export const CAEPI_FTP_ZIP_URL =
  'ftp://ftp.mtps.gov.br/portal/fiscalizacao/seguranca-e-saude-no-trabalho/caepi/tgg_export_caepi.zip';

export const CAEPI_FTP_TXT_URL =
  'ftp://ftp.mtps.gov.br/portal/fiscalizacao/seguranca-e-saude-no-trabalho/caepi/tgg_export_caepi.txt';

/** Fontes oficiais padrao, em ordem de tentativa. */
export const CAEPI_DEFAULT_SOURCE_URLS: readonly string[] = [
  CAEPI_GOVBR_ZIP_URL,
  CAEPI_FTP_ZIP_URL,
  CAEPI_FTP_TXT_URL,
];

export const CAEPI_ALL_SOURCES_FAILED_MESSAGE =
  'Nao foi possivel acessar a fonte oficial CAEPI. Verifique a conexao do servidor ou ajuste a URL tecnica nas variaveis de ambiente.';

export type CaepiRuntimeConfig = {
  /** Override tecnico opcional (CAEPI_SOURCE_URL). */
  sourceUrlOverride: string | null;
  autoSyncEnabled: boolean;
  syncCron: string;
};

export function readCaepiRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env,
): CaepiRuntimeConfig {
  const sourceUrlOverride = (env.CAEPI_SOURCE_URL ?? '').trim() || null;
  const autoSyncEnabled =
    (env.CAEPI_AUTO_SYNC_ENABLED ?? '').trim().toLowerCase() === 'true';
  const syncCron =
    (env.CAEPI_SYNC_CRON ?? '').trim() || CAEPI_DEFAULT_SYNC_CRON;

  return {
    sourceUrlOverride,
    autoSyncEnabled,
    syncCron,
  };
}

/**
 * Lista de URLs a tentar: override tecnico (se houver) + fontes oficiais padrao.
 * Duplicatas sao removidas preservando a ordem.
 */
export function resolveCaepiSourceCandidates(
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const { sourceUrlOverride } = readCaepiRuntimeConfig(env);
  const ordered = [
    ...(sourceUrlOverride ? [sourceUrlOverride] : []),
    ...CAEPI_DEFAULT_SOURCE_URLS,
  ];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const url of ordered) {
    if (!seen.has(url)) {
      seen.add(url);
      result.push(url);
    }
  }
  return result;
}
