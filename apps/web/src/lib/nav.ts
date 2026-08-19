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
    description: 'Painel operacional por CNPJ, estrutura, PGR e usuarios.',
  },
  {
    href: '/certificados',
    label: 'Certificados',
    status: 'ready',
    description: 'Modelos de certificado e registro, geracao A4 por turma.',
  },
  {
    href: '/configuracoes',
    label: 'Configuracoes',
    status: 'ready',
    description:
      'Contatos, equipe, retencao biometrica e reset geral da consultoria.',
  },
  {
    href: '/epi-needs',
    label: 'Necessidades',
    status: 'ready',
    description:
      'Catalogo tecnico de tipos de EPI (oculos, botina, plug) da consultoria.',
  },
  {
    href: '/epis',
    label: 'Catalogo de EPIs',
    status: 'ready',
    description: 'Consulta da base oficial CAEPI (CA, validade, fabricante).',
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
  { href: '/portal/estoque', label: 'Estoque' },
  { href: '/portal/validade', label: 'Validade' },
  { href: '/portal/trabalhadores', label: 'Trabalhadores' },
  { href: '/portal/relatorios', label: 'Relatorios' },
  { href: '/portal/estrutura', label: 'Estrutura' },
  { href: '/portal/documentos-sst', label: 'Documentos SST' },
  { href: '/portal/custos', label: 'Custos' },
  { href: '/portal/conta', label: 'Minha conta' },
];

export function isPortalNavActive(pathname: string, item: PortalNavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
