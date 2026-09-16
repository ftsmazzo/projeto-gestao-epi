export type SupportScopeKind = 'CONSULTORIA' | 'CLIENTE';

export type SupportKnowledgeEntry = {
  id: string;
  scope: SupportScopeKind | 'BOTH';
  question: string;
  answer: string;
  route?: string;
  tags: string[];
};

export const SUPPORT_KNOWLEDGE: SupportKnowledgeEntry[] = [
  {
    id: 'consultoria-clientes',
    scope: 'CONSULTORIA',
    question: 'Como cadastrar um novo cliente atendido?',
    answer:
      'Abra Clientes, clique em Novo cliente, preencha razao social, CNPJ e franquia inicial de vidas. Depois siga o workspace para estrutura, trabalhadores e acesso ao portal.',
    route: '/clientes',
    tags: ['cliente', 'cadastro', 'cnpj', 'franquia'],
  },
  {
    id: 'consultoria-pgr',
    scope: 'CONSULTORIA',
    question: 'Como importar PGR/PGRO?',
    answer:
      'No cliente, use Importar PGR/Atualizar PGR para enviar o arquivo. Revise setores, funcoes, riscos e necessidades antes de confirmar a implantacao.',
    route: '/clientes/importar-pgro',
    tags: ['pgr', 'pgro', 'importar', 'setores', 'funcoes'],
  },
  {
    id: 'consultoria-epis-base',
    scope: 'CONSULTORIA',
    question: 'Como gerenciar catalogo de EPIs da consultoria?',
    answer:
      'Use a tela EPIs para cadastrar por CA, ajustar vida util e vincular necessidades. O catalogo da consultoria abastece os clientes no portal.',
    route: '/epis',
    tags: ['epis', 'catalogo', 'ca', 'vida util'],
  },
  {
    id: 'consultoria-config',
    scope: 'CONSULTORIA',
    question: 'Onde configuro equipe e marca da consultoria?',
    answer:
      'Em Configuracoes voce gerencia membros da equipe, contatos oficiais, marca e politicas operacionais da organizacao.',
    route: '/configuracoes',
    tags: ['configuracoes', 'equipe', 'marca', 'contatos'],
  },
  {
    id: 'cliente-entrega',
    scope: 'CLIENTE',
    question: 'Como registrar uma entrega de EPI?',
    answer:
      'No Painel da Empresa, abra Entregas, selecione o trabalhador, confirme os itens e finalize com assinatura facial presencial ou por link.',
    route: '/portal/entregas',
    tags: ['entrega', 'epi', 'assinatura', 'facial'],
  },
  {
    id: 'cliente-estoque-manual',
    scope: 'CLIENTE',
    question: 'Como dar entrada de EPI sem CA?',
    answer:
      'No Estoque, use entrada manual sem CA e informe nome do EPI, descricao e periodo de uso. Esse item pode ser entregue normalmente depois.',
    route: '/portal/estoque',
    tags: ['estoque', 'sem ca', 'manual', 'entrada'],
  },
  {
    id: 'cliente-trabalhador',
    scope: 'CLIENTE',
    question: 'Como cadastrar trabalhador e biometria?',
    answer:
      'Em Trabalhadores, cadastre os dados basicos e depois gere o link de cadastro facial ou realize captura presencial para habilitar entregas com validacao.',
    route: '/portal/trabalhadores',
    tags: ['trabalhador', 'biometria', 'cadastro facial', 'link'],
  },
  {
    id: 'cliente-validade',
    scope: 'CLIENTE',
    question: 'Onde vejo alertas de troca e vencimento?',
    answer:
      'Use Validade para acompanhar CAs vencidos/proximos e Relatorios para ver reposicoes por trabalhador, funcao e periodo.',
    route: '/portal/validade',
    tags: ['validade', 'ca', 'reposicao', 'alerta'],
  },
  {
    id: 'cliente-documentos-sst',
    scope: 'CLIENTE',
    question: 'Como emitir documentos SST com assinatura?',
    answer:
      'Na aba Documentos SST, gere Integracao ou Ordem de Servico e envie o link para assinatura do trabalhador no celular.',
    route: '/portal/documentos-sst',
    tags: ['sst', 'integracao', 'ordem de servico', 'assinatura'],
  },
  {
    id: 'cliente-relatorios',
    scope: 'CLIENTE',
    question: 'Como extrair indicadores operacionais do cliente?',
    answer:
      'Na tela Relatorios voce filtra periodo, unidade, setor, funcao e trabalhador para analisar entregas, cobertura, estoque, devolucoes e atividade.',
    route: '/portal/relatorios',
    tags: ['relatorios', 'indicadores', 'filtros', 'atividade'],
  },
];

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function score(query: string, text: string) {
  const q = normalize(query);
  const t = normalize(text);
  if (!q || !t) return 0;
  if (t.includes(q)) return 10;
  return q
    .split(/\s+/)
    .filter((part) => part.length > 2)
    .reduce((sum, part) => sum + (t.includes(part) ? 2 : 0), 0);
}

export function searchSupportKnowledge(
  query: string,
  scope: SupportScopeKind,
  limit = 4,
): SupportKnowledgeEntry[] {
  return SUPPORT_KNOWLEDGE
    .filter((entry) => entry.scope === 'BOTH' || entry.scope === scope)
    .map((entry) => ({
      entry,
      score:
        score(query, entry.question) * 3 +
        score(query, entry.answer) +
        entry.tags.reduce((sum, tag) => sum + score(query, tag) * 2, 0),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.entry);
}
