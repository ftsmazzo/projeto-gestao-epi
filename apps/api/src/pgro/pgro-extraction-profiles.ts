/**
 * Perfis de extracao de PGR.
 * Default operacional = template oficial Inseg (sem toggle).
 * Perfis alternativos so entram com toggle + escolha explicita.
 */

export const PGRO_EXTRACTION_PROFILE_INSEG = 'INSEG_OFFICIAL' as const;
export const PGRO_EXTRACTION_PROFILE_CONY = 'CONY_EPI_MATRIX' as const;

export type PgroExtractionProfileId =
  | typeof PGRO_EXTRACTION_PROFILE_INSEG
  | typeof PGRO_EXTRACTION_PROFILE_CONY;

export type PgroExtractionProfile = {
  id: PgroExtractionProfileId;
  label: string;
  description: string;
  /** Se true, e o padrao quando o toggle esta desligado. */
  isDefault: boolean;
};

export const PGRO_EXTRACTION_PROFILES: PgroExtractionProfile[] = [
  {
    id: PGRO_EXTRACTION_PROFILE_INSEG,
    label: 'Inseg (oficial)',
    description:
      'Template oficial Inseg — Caracterizacao do GHE / APRHO em tabelas.',
    isDefault: true,
  },
  {
    id: PGRO_EXTRACTION_PROFILE_CONY,
    label: 'Cony – matriz EPI/GHE',
    description:
      'Layout com cargos por GHE e EPIs em colunas (X) por GHE. Usar so para este tipo de PGR.',
    isDefault: false,
  },
];

export function resolvePgroExtractionProfile(
  raw?: string | null,
): PgroExtractionProfileId {
  const value = (raw ?? '').trim().toUpperCase();
  if (
    value === PGRO_EXTRACTION_PROFILE_CONY ||
    value === 'CONY' ||
    value === 'CONY_EPI_MATRIX'
  ) {
    return PGRO_EXTRACTION_PROFILE_CONY;
  }
  return PGRO_EXTRACTION_PROFILE_INSEG;
}

export function listAlternatePgroExtractionProfiles(): PgroExtractionProfile[] {
  return PGRO_EXTRACTION_PROFILES.filter((p) => !p.isDefault);
}
