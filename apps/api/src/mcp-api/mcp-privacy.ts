export function maskCpf(cpf: string | null | undefined): string {
  const digits = (cpf ?? '').replace(/\D/g, '');
  if (digits.length !== 11) return '—';
  return `${digits.slice(0, 3)}.***.***-${digits.slice(9)}`;
}

export function formatCnpj(cnpj: string | null | undefined): string {
  const d = (cnpj ?? '').replace(/\D/g, '');
  if (d.length !== 14) return cnpj?.trim() || '—';
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}
