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
