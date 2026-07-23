import type { CaCertificate, EpiCategory, EpiUnitOfMeasure } from '@gestao-epi/shared';

export function normalizeCaLookupInput(value: string) {
  return value.trim().replace(/\s+/g, '');
}

export function suggestCategoryFromEquipment(
  equipmentName: string | null | undefined,
): EpiCategory {
  const text = (equipmentName ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

  if (!text) {
    return 'OUTROS';
  }
  if (text.includes('RESPIRADOR') || text.includes('RESPIRATORIO')) {
    return 'RESPIRATORIA';
  }
  if (
    text.includes('PROTETOR AUDITIVO') ||
    text.includes('AUDITIVO') ||
    text.includes('AURICULAR')
  ) {
    return 'AUDITIVA';
  }
  if (text.includes('LUVA')) {
    return 'MAOS';
  }
  if (
    text.includes('OCULOS') ||
    text.includes('VISEIRA') ||
    text.includes('OCULAR') ||
    text.includes('PROTETOR FACIAL')
  ) {
    return 'OLHOS';
  }
  if (text.includes('CAPACETE')) {
    return 'CABECA';
  }
  if (
    text.includes('CALCADO') ||
    text.includes('BOTINA') ||
    text.includes('BOTA')
  ) {
    return 'PES';
  }
  if (
    text.includes('CINTO') ||
    text.includes('TALABARTE') ||
    text.includes('QUEDA')
  ) {
    return 'QUEDA';
  }
  if (
    text.includes('MACACAO') ||
    text.includes('AVENTAL') ||
    text.includes('VESTIMENTA')
  ) {
    return 'TRONCO';
  }
  return 'OUTROS';
}

export function suggestUnitFromEquipment(
  equipmentName: string | null | undefined,
): EpiUnitOfMeasure {
  const text = (equipmentName ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

  if (
    text.includes('LUVA') ||
    text.includes('CALCADO') ||
    text.includes('BOTINA') ||
    text.includes('BOTA') ||
    text.includes('PROTETOR AUDITIVO')
  ) {
    return 'PAR';
  }
  return 'UNIDADE';
}

export function toDateInputValue(value: string | null | undefined) {
  if (!value) return '';
  return value.slice(0, 10);
}

export function formatCaStatusLabel(status: CaCertificate['status']) {
  switch (status) {
    case 'VALIDO':
      return 'VALIDO';
    case 'VENCIDO':
      return 'VENCIDO';
    case 'CANCELADO':
      return 'CANCELADO';
    case 'SUSPENSO':
      return 'SUSPENSO';
    default:
      return 'DESCONHECIDO';
  }
}

export function caStatusClassName(status: CaCertificate['status'] | string) {
  return `caepi-status caepi-status--${String(status).toLowerCase()}`;
}

/** Limites alinhados aos DTOs de create/update EPI. */
export const EPI_FORM_FIELD_LIMITS = {
  name: 200,
  description: 1000,
  caNumber: 40,
  manufacturerName: 200,
  reference: 120,
  color: 80,
  approvedFor: 500,
  restriction: 500,
  technicalNotes: 2000,
  externalCode: 80,
  size: 80,
  model: 120,
  side: 40,
  notes: 500,
} as const;

export function clampEpiField(
  value: string | null | undefined,
  maxLength: number,
): string {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return '';
  if (trimmed.length <= maxLength) return trimmed;
  return trimmed.slice(0, maxLength).trimEnd();
}

export function buildTechnicalNotesFromCertificate(
  certificate: CaCertificate,
): string {
  const parts: string[] = [];
  if (certificate.analysisNotes?.trim()) {
    parts.push(certificate.analysisNotes.trim());
  }
  if (certificate.approvedFor?.trim()) {
    parts.push(`Aprovado para: ${certificate.approvedFor.trim()}`);
  }
  if (certificate.restriction?.trim()) {
    parts.push(`Restricao: ${certificate.restriction.trim()}`);
  }
  if (certificate.norms?.length) {
    const norms = certificate.norms
      .map((norm) => {
        const bits = [
          norm.standard,
          norm.reportNumber ? `laudo ${norm.reportNumber}` : null,
          norm.laboratoryName,
        ].filter(Boolean);
        return bits.join(' — ');
      })
      .filter(Boolean);
    if (norms.length) {
      parts.push(`Normas/laudos: ${norms.join('; ')}`);
    }
  }
  return clampEpiField(
    parts.join('\n\n'),
    EPI_FORM_FIELD_LIMITS.technicalNotes,
  );
}

/** Opcoes padrao de tamanho (vestuario, calcado e luvas). */
export const EPI_SIZE_OPTIONS = [
  'Unico',
  'PP',
  'P',
  'M',
  'G',
  'GG',
  'XG',
  'XXG',
  '34',
  '35',
  '36',
  '37',
  '38',
  '39',
  '40',
  '41',
  '42',
  '43',
  '44',
  '45',
  '46',
  '47',
  '48',
  '6',
  '7',
  '8',
  '9',
  '10',
  '11',
] as const;

export const EPI_SIDE_OPTIONS = ['Esquerdo', 'Direito', 'Par'] as const;

export const EPI_COLOR_OPTIONS = [
  'Preto',
  'Branco',
  'Branca',
  'Azul',
  'Verde',
  'Amarelo',
  'Vermelho',
  'Cinza',
  'Laranja',
  'Marrom',
  'Incolor',
  'Transparente',
] as const;

/** Normaliza cor CAEPI para casar com opcoes do seletor quando possivel. */
export function normalizeColorOption(raw: string | null | undefined): string {
  const value = (raw ?? '').trim().replace(/\.$/, '');
  if (!value) return '';
  const found = EPI_COLOR_OPTIONS.find(
    (option) => option.toLowerCase() === value.toLowerCase(),
  );
  return clampEpiField(found ?? value, EPI_FORM_FIELD_LIMITS.color);
}

export function mergeSelectOptions(
  base: readonly string[],
  ...extras: Array<string | null | undefined>
): string[] {
  const result = [...base];
  const seen = new Set(base.map((item) => item.toLowerCase()));
  for (const extra of extras) {
    const value = (extra ?? '').trim();
    if (!value) continue;
    if (seen.has(value.toLowerCase())) continue;
    seen.add(value.toLowerCase());
    result.push(value);
  }
  return result;
}

/**
 * Extrai tamanhos citados na descricao/referencia (ex.: "P/M/G", "tamanhos 38 a 42").
 */
export function extractSuggestedSizes(
  ...texts: Array<string | null | undefined>
): string[] {
  const blob = texts.filter(Boolean).join(' ');
  if (!blob) return [];

  const found = new Set<string>();
  const upper = blob.toUpperCase();

  for (const size of ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XXG']) {
    const pattern = new RegExp(`(?:^|[^A-Z0-9])${size}(?:[^A-Z0-9]|$)`);
    if (pattern.test(upper)) {
      found.add(size);
    }
  }

  const ranges = blob.matchAll(/\b(\d{2})\s*(?:a|ate|-|–|—)\s*(\d{2})\b/gi);
  for (const match of ranges) {
    const start = Number(match[1]);
    const end = Number(match[2]);
    if (start >= 34 && end <= 48 && start <= end) {
      for (let n = start; n <= end; n += 1) {
        found.add(String(n));
      }
    }
  }

  const singles = blob.matchAll(/\b(3[4-9]|4[0-8])\b/g);
  for (const match of singles) {
    found.add(match[1]);
  }

  return [...found];
}

export type CaepiVariantSeed = {
  size: string;
  color: string;
  model: string;
  side: string;
  notes: string;
  isActive: boolean;
};

export type CaepiFormPatch = {
  name: string;
  caNumber: string;
  caExpiresAt: string;
  requiresCa: true;
  manufacturerName: string;
  reference: string;
  color: string;
  approvedFor: string;
  restriction: string;
  technicalNotes: string;
  description?: string;
  category: EpiCategory;
  unitOfMeasure: EpiUnitOfMeasure;
  variantSeeds: CaepiVariantSeed[];
};

export function buildCaepiFormPatch(
  certificate: CaCertificate,
): CaepiFormPatch {
  const color = normalizeColorOption(certificate.color);
  const model = clampEpiField(
    certificate.reference ?? certificate.brand ?? '',
    EPI_FORM_FIELD_LIMITS.model,
  );
  const sizes = extractSuggestedSizes(
    certificate.equipmentDescription,
    certificate.reference,
    certificate.equipmentName,
  );

  const variantSeeds: CaepiVariantSeed[] = [];
  if (sizes.length > 0) {
    for (const size of sizes.slice(0, 12)) {
      variantSeeds.push({
        size,
        color,
        model,
        side: '',
        notes: '',
        isActive: true,
      });
    }
  } else if (color || model) {
    variantSeeds.push({
      size: '',
      color,
      model,
      side: '',
      notes: '',
      isActive: true,
    });
  }

  return {
    name: clampEpiField(
      certificate.equipmentName ?? '',
      EPI_FORM_FIELD_LIMITS.name,
    ),
    caNumber: clampEpiField(
      certificate.caNumber,
      EPI_FORM_FIELD_LIMITS.caNumber,
    ),
    caExpiresAt: toDateInputValue(certificate.expiresAt),
    requiresCa: true,
    manufacturerName: clampEpiField(
      certificate.manufacturerName ?? '',
      EPI_FORM_FIELD_LIMITS.manufacturerName,
    ),
    reference: clampEpiField(
      certificate.reference ?? '',
      EPI_FORM_FIELD_LIMITS.reference,
    ),
    color,
    approvedFor: clampEpiField(
      certificate.approvedFor ?? '',
      EPI_FORM_FIELD_LIMITS.approvedFor,
    ),
    restriction: clampEpiField(
      certificate.restriction ?? '',
      EPI_FORM_FIELD_LIMITS.restriction,
    ),
    technicalNotes: buildTechnicalNotesFromCertificate(certificate),
    description: certificate.equipmentDescription?.trim()
      ? clampEpiField(
          certificate.equipmentDescription,
          EPI_FORM_FIELD_LIMITS.description,
        )
      : undefined,
    category: suggestCategoryFromEquipment(certificate.equipmentName),
    unitOfMeasure: suggestUnitFromEquipment(certificate.equipmentName),
    variantSeeds,
  };
}
