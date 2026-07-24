export type NavItemStatus = 'ready' | 'soon' | 'via-client';

export type OpsNavItem = {
  href: string;
  label: string;
  status: NavItemStatus;
  description: string;
};

/**
 * Navegacao enxuta da Consultoria/Gestao (tenant).
 * Operacao por CNPJ fica no workspace do cliente.
 */
export const OPS_NAV: OpsNavItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    status: 'ready',
    description: 'Visao geral da consultoria e franquia de vidas.',
  },
  {
    href: '/clientes',
    label: 'Clientes atendidos',
    status: 'ready',
    description: 'Painel operacional por CNPJ, estrutura, PGRO e usuarios.',
  },
  {
    href: '/caepi',
    label: 'Base CAEPI',
    status: 'ready',
    description: 'Base oficial de CAs (global).',
  },
];

export type PortalNavItem = {
  href: string;
  label: string;
  /** Match exato (ex.: /portal) vs prefixo. */
  exact?: boolean;
};

/**
 * Menu do dia a dia da empresa cliente (Painel do Cliente).
 * Nao misturar com OPS_NAV da Consultoria.
 */
export const PORTAL_NAV: PortalNavItem[] = [
  { href: '/portal', label: 'Painel', exact: true },
  { href: '/portal/entregas', label: 'Entregas' },
  { href: '/portal/validade', label: 'Validade' },
  { href: '/portal/custos', label: 'Custos' },
  { href: '/portal/estoque', label: 'Estoque' },
  { href: '/portal/conta', label: 'Minha conta' },
];

export function isPortalNavActive(pathname: string, item: PortalNavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
