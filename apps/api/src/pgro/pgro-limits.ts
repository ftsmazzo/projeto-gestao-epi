/** Limite de nome usado no confirm PGRO (DTO + banco). */
export const PGRO_MAX_NAME_LENGTH = 160;

export function clampPgroName(
  value: string,
  max = PGRO_MAX_NAME_LENGTH,
): string {
  const cleaned = value.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= max) return cleaned;
  return cleaned.slice(0, max).trimEnd();
}
