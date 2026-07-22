const CNPJ_LENGTH = 14;

/** Remove mascara e espacos; mantem letras A-Z e digitos; converte para maiusculas. */
export function normalizeCnpj(value: string): string {
  return value.toUpperCase().replace(/[^0-9A-Z]/g, '');
}

/** @deprecated Preferir normalizeCnpj. */
export function stripCnpj(value: string): string {
  return normalizeCnpj(value);
}

export function formatCnpjInput(value: string): string {
  const raw = normalizeCnpj(value).slice(0, CNPJ_LENGTH);
  const parts = [
    raw.slice(0, 2),
    raw.slice(2, 5),
    raw.slice(5, 8),
    raw.slice(8, 12),
    raw.slice(12, 14),
  ];

  if (raw.length <= 2) return parts[0];
  if (raw.length <= 5) return `${parts[0]}.${parts[1]}`;
  if (raw.length <= 8) return `${parts[0]}.${parts[1]}.${parts[2]}`;
  if (raw.length <= 12) {
    return `${parts[0]}.${parts[1]}.${parts[2]}/${parts[3]}`;
  }
  return `${parts[0]}.${parts[1]}.${parts[2]}/${parts[3]}-${parts[4]}`;
}

export function formatCnpj(value: string): string {
  const cnpj = normalizeCnpj(value);
  if (cnpj.length !== CNPJ_LENGTH) {
    return value;
  }
  return formatCnpjInput(cnpj);
}

const WEIGHTS_DV1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const WEIGHTS_DV2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

function charValue(char: string): number {
  return char.charCodeAt(0) - 48;
}

function calcCheckDigit(base: string, weights: number[]): number {
  const sum = base
    .split('')
    .reduce((acc, char, index) => acc + charValue(char) * weights[index], 0);
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

export function isValidCnpj(value: string): boolean {
  const normalized = normalizeCnpj(value);
  if (normalized.length !== CNPJ_LENGTH) return false;
  if (!/^[0-9A-Z]{12}\d{2}$/.test(normalized)) return false;
  if (/^([0-9A-Z])\1{13}$/.test(normalized)) return false;

  const base = normalized.slice(0, 12);
  const digit1 = calcCheckDigit(base, WEIGHTS_DV1);
  const digit2 = calcCheckDigit(`${base}${digit1}`, WEIGHTS_DV2);
  return normalized === `${base}${digit1}${digit2}`;
}

export function cnpjClientValidationMessage(value: string): string | null {
  if (!value.trim()) {
    return 'Informe o CNPJ do cliente atendido.';
  }

  const normalized = normalizeCnpj(value);

  if (normalized.length !== CNPJ_LENGTH) {
    return 'CNPJ incompleto. Digite 14 caracteres (com ou sem mascara).';
  }

  if (!/^[0-9A-Z]{12}\d{2}$/.test(normalized)) {
    return 'Os 2 ultimos caracteres do CNPJ devem ser digitos verificadores.';
  }

  if (!isValidCnpj(normalized)) {
    return 'CNPJ informado, mas os digitos verificadores nao conferem. Confira se houve troca de numero ou caractere.';
  }

  return null;
}
