const CNPJ_LENGTH = 14;

export function stripCnpj(value: string): string {
  return value.replace(/\D/g, '');
}

export function formatCnpj(digits: string): string {
  const cnpj = stripCnpj(digits);
  if (cnpj.length !== CNPJ_LENGTH) {
    return digits;
  }
  return cnpj.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    '$1.$2.$3/$4-$5',
  );
}

function calcCnpjDigit(base: string, weights: number[]): number {
  const sum = base
    .split('')
    .reduce((acc, digit, index) => acc + Number(digit) * weights[index], 0);
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

export function isValidCnpj(value: string): boolean {
  const cnpj = stripCnpj(value);
  if (cnpj.length !== CNPJ_LENGTH) {
    return false;
  }
  if (/^(\d)\1+$/.test(cnpj)) {
    return false;
  }

  const base = cnpj.slice(0, 12);
  const digit1 = calcCnpjDigit(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const digit2 = calcCnpjDigit(
    `${base}${digit1}`,
    [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  );

  return cnpj === `${base}${digit1}${digit2}`;
}
