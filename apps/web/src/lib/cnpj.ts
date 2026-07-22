const CNPJ_LENGTH = 14;

export function stripCnpj(value: string): string {
  return value.replace(/\D/g, '');
}

export function formatCnpjInput(value: string): string {
  const digits = stripCnpj(value).slice(0, CNPJ_LENGTH);
  const parts = [
    digits.slice(0, 2),
    digits.slice(2, 5),
    digits.slice(5, 8),
    digits.slice(8, 12),
    digits.slice(12, 14),
  ];

  if (digits.length <= 2) return parts[0];
  if (digits.length <= 5) return `${parts[0]}.${parts[1]}`;
  if (digits.length <= 8) return `${parts[0]}.${parts[1]}.${parts[2]}`;
  if (digits.length <= 12) {
    return `${parts[0]}.${parts[1]}.${parts[2]}/${parts[3]}`;
  }
  return `${parts[0]}.${parts[1]}.${parts[2]}/${parts[3]}-${parts[4]}`;
}

export function formatCnpj(value: string): string {
  const digits = stripCnpj(value);
  if (digits.length !== CNPJ_LENGTH) {
    return value;
  }
  return formatCnpjInput(digits);
}
