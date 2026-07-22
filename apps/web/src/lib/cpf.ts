const CPF_LENGTH = 11;

export function stripCpf(value: string): string {
  return value.replace(/\D/g, '');
}

export function formatCpfInput(value: string): string {
  const digits = stripCpf(value).slice(0, CPF_LENGTH);
  const parts = [
    digits.slice(0, 3),
    digits.slice(3, 6),
    digits.slice(6, 9),
    digits.slice(9, 11),
  ];

  if (digits.length <= 3) return parts[0];
  if (digits.length <= 6) return `${parts[0]}.${parts[1]}`;
  if (digits.length <= 9) return `${parts[0]}.${parts[1]}.${parts[2]}`;
  return `${parts[0]}.${parts[1]}.${parts[2]}-${parts[3]}`;
}

export function formatCpf(value: string): string {
  const digits = stripCpf(value);
  if (digits.length !== CPF_LENGTH) {
    return value;
  }
  return formatCpfInput(digits);
}
