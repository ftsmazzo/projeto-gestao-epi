const CNPJ_LENGTH = 14;
const CNPJ_BASE_LENGTH = 12;
const WEIGHTS_DV1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const WEIGHTS_DV2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

const CHECK_DIGITS_MESSAGE =
  'CNPJ informado, mas os digitos verificadores nao conferem. Confira se houve troca de numero ou caractere e tente novamente.';

export type CnpjValidationFailureCode =
  | 'empty'
  | 'length'
  | 'charset'
  | 'repeated'
  | 'check_digits';

export type CnpjValidationResult =
  | { ok: true; normalized: string }
  | { ok: false; code: CnpjValidationFailureCode; message: string };

/** Remove mascara e espacos; mantem letras A-Z e digitos; converte para maiusculas. */
export function normalizeCnpj(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '');
}

/** @deprecated Preferir normalizeCnpj. Mantido para compatibilidade numerica. */
export function stripCnpj(value: string): string {
  return normalizeCnpj(value);
}

export function formatCnpj(value: string): string {
  const cnpj = normalizeCnpj(value);
  if (cnpj.length !== CNPJ_LENGTH) {
    return value;
  }
  return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12, 14)}`;
}

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

function computeCheckDigits(base12: string): string {
  const digit1 = calcCheckDigit(base12, WEIGHTS_DV1);
  const digit2 = calcCheckDigit(`${base12}${digit1}`, WEIGHTS_DV2);
  return `${digit1}${digit2}`;
}

export function validateCnpj(value: string): CnpjValidationResult {
  if (!value || !value.trim()) {
    return {
      ok: false,
      code: 'empty',
      message: 'Informe o CNPJ do cliente atendido.',
    };
  }

  const normalized = normalizeCnpj(value);

  if (normalized.length !== CNPJ_LENGTH) {
    return {
      ok: false,
      code: 'length',
      message:
        'CNPJ deve ter 14 caracteres (letras e numeros na raiz/ordem; os 2 ultimos sao digitos verificadores).',
    };
  }

  if (!/^[0-9A-Z]{12}\d{2}$/.test(normalized)) {
    return {
      ok: false,
      code: 'charset',
      message:
        'CNPJ invalido: use A-Z e 0-9 nas 12 primeiras posicoes; os 2 ultimos caracteres devem ser digitos.',
    };
  }

  if (/^([0-9A-Z])\1{13}$/.test(normalized)) {
    return {
      ok: false,
      code: 'repeated',
      message: 'CNPJ invalido: nao use a mesma sequencia repetida em todas as posicoes.',
    };
  }

  const base = normalized.slice(0, CNPJ_BASE_LENGTH);
  const expected = computeCheckDigits(base);
  const actual = normalized.slice(CNPJ_BASE_LENGTH);

  if (actual !== expected) {
    return {
      ok: false,
      code: 'check_digits',
      message: CHECK_DIGITS_MESSAGE,
    };
  }

  return { ok: true, normalized };
}

export function isValidCnpj(value: string): boolean {
  return validateCnpj(value).ok;
}

export function cnpjValidationMessage(value: string): string | null {
  const result = validateCnpj(value);
  return result.ok ? null : result.message;
}
