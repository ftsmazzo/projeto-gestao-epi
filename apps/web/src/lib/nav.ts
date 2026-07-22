export type NavItemStatus = 'ready' | 'soon';

export type OpsNavItem = {
  href: string;
  label: string;
  status: NavItemStatus;
  description: string;
};

/** Navegacao do Web Admin (tenant). Portal do cliente fica separado. */
export const OPS_NAV: OpsNavItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    status: 'ready',
    description: 'Resumo da organizacao e proximos passos.',
  },
  {
    href: '/clientes',
    label: 'Clientes atendidos',
    status: 'ready',
    description: 'CNPJ, cotas de vidas e isolamento por cliente.',
  },
  {
    href: '/trabalhadores',
    label: 'Trabalhadores',
    status: 'soon',
    description: 'Acesso global em breve; cadastro ja disponivel no detalhe do cliente.',
  },
  {
    href: '/epis',
    label: 'EPIs',
    status: 'ready',
    description: 'Catalogo mestre com CA, validade e status.',
  },
  {
    href: '/caepi',
    label: 'Base CAEPI',
    status: 'ready',
    description: 'Atualizacao e monitoramento da base oficial de CAs.',
  },
  {
    href: '/estoque',
    label: 'Estoque',
    status: 'soon',
    description: 'Saldos, lotes e movimentacoes.',
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
  {
    href: '/configuracoes',
    label: 'Configuracoes',
    status: 'soon',
    description: 'Organizacao, usuarios e parametros.',
  },
];
