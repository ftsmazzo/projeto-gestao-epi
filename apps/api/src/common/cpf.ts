const CPF_LENGTH = 11;

export function stripCpf(value: string): string {
  return value.replace(/\D/g, '');
}

export function formatCpf(digits: string): string {
  const cpf = stripCpf(digits);
  if (cpf.length !== CPF_LENGTH) {
    return digits;
  }
  return cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
}

function calcCpfDigit(base: string, factor: number): number {
  let sum = 0;
  for (let index = 0; index < base.length; index += 1) {
    sum += Number(base[index]) * (factor - index);
  }
  const remainder = (sum * 10) % 11;
  return remainder === 10 ? 0 : remainder;
}

export function isValidCpf(value: string): boolean {
  const cpf = stripCpf(value);
  if (cpf.length !== CPF_LENGTH) {
    return false;
  }
  if (/^(\d)\1+$/.test(cpf)) {
    return false;
  }

  const base = cpf.slice(0, 9);
  const digit1 = calcCpfDigit(base, 10);
  const digit2 = calcCpfDigit(`${base}${digit1}`, 11);

  return cpf === `${base}${digit1}${digit2}`;
}

/** Metadados seguros para auditoria — nunca inclui CPF completo. */
export function cpfAuditMeta(cpf: string | null | undefined): {
  hasCpf: boolean;
  cpfLast4: string | null;
} {
  if (!cpf) {
    return { hasCpf: false, cpfLast4: null };
  }
  const digits = stripCpf(cpf);
  return {
    hasCpf: digits.length > 0,
    cpfLast4: digits.length >= 4 ? digits.slice(-4) : null,
  };
}
