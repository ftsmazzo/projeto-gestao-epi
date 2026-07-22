import type { CaCertificate, EpiCategory } from '@gestao-epi/shared';

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
    text.includes('OCULAR')
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
  return 'OUTROS';
}

export function toDateInputValue(value: string | null | undefined) {
  if (!value) return '';
  return value.slice(0, 10);
}

export function formatCaStatusLabel(status: CaCertificate['status']) {
  switch (status) {
    case 'VALIDO':
      return 'Valido';
    case 'VENCIDO':
      return 'Vencido';
    case 'CANCELADO':
      return 'Cancelado';
    case 'SUSPENSO':
      return 'Suspenso';
    default:
      return 'Desconhecido';
  }
}

export function buildTechnicalNotesFromCertificate(
  certificate: CaCertificate,
): string {
  const parts: string[] = [];
  if (certificate.analysisNotes?.trim()) {
    parts.push(certificate.analysisNotes.trim());
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
  return parts.join('\n\n');
}

export type CaepiFormPatch = {
  caNumber: string;
  caExpiresAt: string;
  manufacturerName: string;
  reference: string;
  color: string;
  approvedFor: string;
  restriction: string;
  technicalNotes: string;
  description?: string;
  category: EpiCategory;
};

export function buildCaepiFormPatch(
  certificate: CaCertificate,
): CaepiFormPatch {
  return {
    caNumber: certificate.caNumber,
    caExpiresAt: toDateInputValue(certificate.expiresAt),
    manufacturerName: certificate.manufacturerName ?? '',
    reference: certificate.reference ?? '',
    color: certificate.color ?? '',
    approvedFor: certificate.approvedFor ?? '',
    restriction: certificate.restriction ?? '',
    technicalNotes: buildTechnicalNotesFromCertificate(certificate),
    description: certificate.equipmentDescription?.trim() || undefined,
    category: suggestCategoryFromEquipment(certificate.equipmentName),
  };
}
