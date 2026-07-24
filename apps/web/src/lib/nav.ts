export type NavItemStatus = 'ready' | 'soon' | 'via-client';

export type OpsNavItem = {
  href: string;
  label: string;
  status: NavItemStatus;
  description: string;
};

/**
 * Navegacao da Consultoria/Gestao (tenant).
 * Operacao diaria de EPI/estoque/necessidades deve partir do painel do cliente.
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
  {
    href: '/configuracoes',
    label: 'Configuracoes',
    status: 'soon',
    description: 'Organizacao, usuarios da consultoria e parametros.',
  },
  {
    href: '/epis',
    label: 'EPIs (catalogo)',
    status: 'via-client',
    description: 'Catalogo do tenant. Prefira operar a partir do cliente.',
  },
  {
    href: '/epi-needs',
    label: 'Necessidades de EPI',
    status: 'via-client',
    description: 'Catalogo do tenant. Prefira via painel do cliente.',
  },
  {
    href: '/estoque',
    label: 'Estoque',
    status: 'via-client',
    description: 'Estoque do tenant. Prefira via painel do cliente.',
  },
  {
    href: '/trabalhadores',
    label: 'Trabalhadores',
    status: 'soon',
    description: 'Importacao e gestao global em breve; vidas no painel do cliente.',
  },
  {
    href: '/entregas',
    label: 'Entregas',
    status: 'soon',
    description: 'Registro operacional e ficha eletronica.',
  },
  {
    href: '/documentos',
    label: 'Documentos',
    status: 'soon',
    description: 'Termos, evidencias e exportacoes.',
  },
  {
    href: '/relatorios',
    label: 'Relatorios',
    status: 'soon',
    description: 'Visao gerencial e auditoria.',
  },
];
