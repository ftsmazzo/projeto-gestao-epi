export type SupportScopeKind = 'CONSULTORIA' | 'CLIENTE';

export type SupportKnowledgeEntry = {
  id: string;
  scope: SupportScopeKind | 'BOTH';
  title: string;
  question: string;
  answer: string;
  route?: string;
  routeAlias?: string[];
  steps?: string[];
  warnings?: string[];
  tags: string[];
};

export const SUPPORT_KNOWLEDGE: SupportKnowledgeEntry[] = [
  {
    id: 'vision-produtiva',
    scope: 'BOTH',
    title: 'Objetivo do ProntEPI',
    question: 'Qual e o objetivo do sistema?',
    answer:
      'O ProntEPI conecta implantacao (PGR, estrutura e trabalhadores) com operacao diaria (estoque, entrega com evidencia, validade e relatorios).',
    tags: ['objetivo', 'visao geral', 'sistema', 'prontepi'],
  },
  {
    id: 'consultoria-dashboard',
    scope: 'CONSULTORIA',
    title: 'Dashboard da consultoria',
    question: 'Como usar o dashboard da consultoria?',
    answer:
      'No dashboard voce monitora franquia de vidas, clientes ativos e atalhos do ciclo de implantacao para priorizar gargalos.',
    route: '/dashboard',
    tags: ['dashboard', 'franquia', 'vidas', 'consultoria'],
  },
  {
    id: 'consultoria-clientes-cadastro',
    scope: 'CONSULTORIA',
    title: 'Cadastro de cliente atendido',
    question: 'Como cadastrar um novo cliente atendido?',
    answer:
      'Abra Clientes, clique em Novo cliente, preencha razao social, CNPJ e franquia inicial de vidas. Em seguida continue pelo workspace de implantacao.',
    route: '/clientes',
    steps: [
      'Criar cliente com CNPJ e status ativo.',
      'Abrir workspace e validar roteiro de implantacao.',
      'Estruturar PGR, cadastrar trabalhadores e liberar portal.',
    ],
    tags: ['cliente', 'cadastro', 'cnpj', 'franquia'],
  },
  {
    id: 'consultoria-workspace',
    scope: 'CONSULTORIA',
    title: 'Workspace por cliente',
    question: 'Como funciona o workspace do cliente na consultoria?',
    answer:
      'O workspace organiza a implantacao por etapas: estrutura, atualizar/importar PGR, usuarios, unidades e trabalhadores.',
    route: '/clientes/[id]',
    routeAlias: ['/clientes/', '/clientes/[id]/estrutura', '/clientes/[id]/usuarios'],
    tags: ['workspace', 'implantacao', 'cliente', 'etapas'],
  },
  {
    id: 'consultoria-pgr-importar',
    scope: 'CONSULTORIA',
    title: 'Importacao de PGR/PGRO',
    question: 'Como importar PGR/PGRO?',
    answer:
      'No cliente, use Importar PGR/Atualizar PGR para enviar o arquivo. Revise setores, funcoes, riscos e necessidades antes de confirmar.',
    route: '/clientes/importar-pgro',
    routeAlias: ['/clientes/[id]/atualizar-pgro'],
    warnings: [
      'Nao confirme preview sem revisar setores e funcoes.',
      'Se cobertura vier fraca, ajuste antes de confirmar para evitar estrutura errada.',
    ],
    tags: ['pgr', 'pgro', 'importar', 'setores', 'funcoes'],
  },
  {
    id: 'consultoria-clientes-grupos',
    scope: 'CONSULTORIA',
    title: 'Grupos empresariais',
    question: 'Como funciona grupo de clientes?',
    answer:
      'Grupo permite operar multiplos CNPJs com mesmo usuario de portal. A operacao (estoque, entrega, relatorios) continua separada por CNPJ.',
    route: '/clientes/grupos',
    tags: ['grupo', 'cnpj', 'acesso', 'portal'],
  },
  {
    id: 'consultoria-epis-base',
    scope: 'CONSULTORIA',
    title: 'Catalogo de EPIs da consultoria',
    question: 'Como gerenciar catalogo de EPIs da consultoria?',
    answer:
      'Use a tela EPIs para cadastrar por CA, ajustar vida util e vincular necessidades. O catalogo da consultoria abastece os clientes no portal.',
    route: '/epis',
    warnings: [
      'CA invalido ou vencido impacta validacao e sugestoes.',
      'Vida util mal definida prejudica previsao de reposicao.',
    ],
    tags: ['epis', 'catalogo', 'ca', 'vida util'],
  },
  {
    id: 'consultoria-needs',
    scope: 'CONSULTORIA',
    title: 'Necessidades de EPI',
    question: 'Qual a diferenca entre necessidade e item de EPI?',
    answer:
      'Necessidade representa o tipo funcional (ex.: protetor auricular). Item e o produto real com CA e estoque. A ligacao entre ambos habilita cobertura.',
    route: '/epi-needs',
    tags: ['need', 'necessidade', 'item', 'cobertura'],
  },
  {
    id: 'consultoria-usuarios-cliente',
    scope: 'CONSULTORIA',
    title: 'Usuarios do portal do cliente',
    question: 'Como liberar acesso do gestor e operador do cliente?',
    answer:
      'No workspace do cliente, use Usuarios para criar gestor e operadores. O gestor administra o painel; operador executa operacao diaria.',
    route: '/clientes/[id]/usuarios',
    tags: ['usuarios', 'gestor', 'operador', 'acesso'],
  },
  {
    id: 'consultoria-unidades',
    scope: 'CONSULTORIA',
    title: 'Unidades do cliente',
    question: 'Como organizar unidades/filiais do cliente?',
    answer:
      'Cadastre unidades para segmentar trabalhadores, setores e relatorios por local operacional.',
    route: '/clientes/[id]/unidades',
    tags: ['unidades', 'filial', 'operacional', 'estrutura'],
  },
  {
    id: 'consultoria-config',
    scope: 'CONSULTORIA',
    title: 'Configuracoes da consultoria',
    question: 'Onde configuro equipe e marca da consultoria?',
    answer:
      'Em Configuracoes voce gerencia equipe, contatos oficiais, marca, retencao biometrica e ajustes operacionais.',
    route: '/configuracoes',
    tags: ['configuracoes', 'equipe', 'marca', 'contatos'],
  },
  {
    id: 'consultoria-certificados',
    scope: 'CONSULTORIA',
    title: 'Certificados e treinamentos',
    question: 'Como emitir certificados de treinamento?',
    answer:
      'Use Certificados para manter modelos e gerar emissao por turma com trilha de reimpressao.',
    route: '/certificados',
    routeAlias: ['/certificados/gerar'],
    tags: ['certificados', 'treinamento', 'turma', 'registro'],
  },
  {
    id: 'cliente-painel',
    scope: 'CLIENTE',
    title: 'Painel da empresa',
    question: 'O que vejo no painel da empresa?',
    answer:
      'O painel mostra indicadores de vidas, atencoes, atalhos para entrega e estoque, e o validador rapido de CA.',
    route: '/portal',
    tags: ['painel', 'kpi', 'alertas', 'ca'],
  },
  {
    id: 'cliente-entrega',
    scope: 'CLIENTE',
    title: 'Entrega de EPI',
    question: 'Como registrar uma entrega de EPI?',
    answer:
      'No Painel da Empresa, abra Entregas, selecione o trabalhador, confirme os itens e finalize com assinatura facial presencial ou por link.',
    route: '/portal/entregas',
    routeAlias: ['/portal/entregas/[id]'],
    steps: [
      'Selecionar trabalhador com biometria valida.',
      'Conferir cobertura e estoque dos itens.',
      'Finalizar com evidencia facial presencial ou remota.',
    ],
    tags: ['entrega', 'epi', 'assinatura', 'facial'],
  },
  {
    id: 'cliente-entrega-extra',
    scope: 'CLIENTE',
    title: 'Entrega extra fora indicacao',
    question: 'Como entregar EPI extra fora da indicacao?',
    answer:
      'Na entrega, marque item extra e selecione EPI por CA/estoque. Esse item nao depende de requisito normativo da funcao.',
    route: '/portal/entregas',
    tags: ['extra', 'fora indicacao', 'ca', 'entrega'],
  },
  {
    id: 'cliente-assinatura-remota',
    scope: 'CLIENTE',
    title: 'Assinatura remota por link',
    question: 'Como funciona assinatura por link na entrega de EPI?',
    answer:
      'Antes da camera presencial, pode enviar link para o celular do trabalhador assinar com validacao facial remota. Se nao concluir, segue fluxo presencial.',
    route: '/portal/entregas',
    tags: ['assinatura remota', 'link', 'whatsapp', 'fallback'],
  },
  {
    id: 'cliente-estoque-manual',
    scope: 'CLIENTE',
    title: 'Entrada manual de EPI sem CA',
    question: 'Como dar entrada de EPI sem CA?',
    answer:
      'No Estoque, use entrada manual sem CA e informe nome do EPI, descricao e periodo de uso. Esse item pode ser entregue normalmente depois.',
    route: '/portal/estoque',
    warnings: [
      'Defina vida util coerente para manter reposicao correta.',
      'Descricao clara melhora rastreabilidade nas fichas.',
    ],
    tags: ['estoque', 'sem ca', 'manual', 'entrada'],
  },
  {
    id: 'cliente-estoque-custos',
    scope: 'CLIENTE',
    title: 'Custos e notas',
    question: 'Como acompanhar custo de EPI e nota fiscal?',
    answer:
      'Use Custos para enviar nota, extrair linhas e acompanhar valor comprado, entregue e saldo valorizado.',
    route: '/portal/custos',
    tags: ['custos', 'nota', 'nf', 'valor'],
  },
  {
    id: 'cliente-trabalhador',
    scope: 'CLIENTE',
    title: 'Trabalhadores e biometria',
    question: 'Como cadastrar trabalhador e biometria?',
    answer:
      'Em Trabalhadores, cadastre os dados basicos e depois gere o link de cadastro facial ou realize captura presencial para habilitar entregas com validacao.',
    route: '/portal/trabalhadores',
    routeAlias: ['/portal/trabalhadores/[id]/ficha-epi'],
    steps: [
      'Cadastrar dados e vincular funcao/setor.',
      'Garantir consentimento e biometria ativa.',
      'Validar ficha de EPI e proximas trocas.',
    ],
    tags: ['trabalhador', 'biometria', 'cadastro facial', 'link'],
  },
  {
    id: 'cliente-documentos-assinatura',
    scope: 'CLIENTE',
    title: 'Documentos SST com assinatura',
    question: 'Como enviar Integracao e Ordem de Servico para assinatura?',
    answer:
      'Em Documentos SST, gere o documento e dispare link de assinatura no celular do trabalhador. O status muda para assinado quando concluido.',
    route: '/portal/documentos-sst',
    tags: ['sst', 'integracao', 'ordem servico', 'assinatura'],
  },
  {
    id: 'cliente-estrutura',
    scope: 'CLIENTE',
    title: 'Estrutura do cliente',
    question: 'Como revisar estrutura de setores e funcoes no portal?',
    answer:
      'Na Estrutura voce visualiza setores, funcoes, riscos e necessidades para validar aderencia da operacao ao PGR implantado.',
    route: '/portal/estrutura',
    routeAlias: ['/portal/estrutura/atualizar-pgr'],
    tags: ['estrutura', 'setores', 'funcoes', 'riscos'],
  },
  {
    id: 'cliente-validade',
    scope: 'CLIENTE',
    title: 'Validade e reposicao',
    question: 'Onde vejo alertas de troca e vencimento?',
    answer:
      'Use Validade para acompanhar CAs vencidos/proximos e Relatorios para ver reposicoes por trabalhador, funcao e periodo.',
    route: '/portal/validade',
    warnings: [
      'A reposicao usa vida util total da entrega conforme regra vigente.',
      'Itens sem vida util definida reduzem previsibilidade dos alertas.',
    ],
    tags: ['validade', 'ca', 'reposicao', 'alerta'],
  },
  {
    id: 'cliente-relatorios',
    scope: 'CLIENTE',
    title: 'Relatorios do cliente',
    question: 'Como extrair indicadores operacionais do cliente?',
    answer:
      'Na tela Relatorios voce filtra periodo, unidade, setor, funcao e trabalhador para analisar entregas, cobertura, estoque, devolucoes e atividade.',
    route: '/portal/relatorios',
    tags: ['relatorios', 'indicadores', 'filtros', 'atividade'],
  },
  {
    id: 'cliente-ficha-epi-pdf',
    scope: 'CLIENTE',
    title: 'Ficha de EPI e comprovante PDF',
    question: 'A ficha e o comprovante refletem reemissao e regra da epoca?',
    answer:
      'Sim. PDFs exibem data de emissao/reemissao e aviso de que os calculos refletem as regras vigentes no momento da geracao.',
    route: '/portal/trabalhadores/[id]/ficha-epi',
    tags: ['ficha epi', 'pdf', 'reemissao', 'declaracao'],
  },
  {
    id: 'cliente-conta',
    scope: 'CLIENTE',
    title: 'Conta e senha do portal',
    question: 'Onde troco senha no portal do cliente?',
    answer:
      'Use Minha conta para alterar senha. Se for senha temporaria, o sistema pede troca obrigatoria no primeiro acesso.',
    route: '/portal/conta',
    tags: ['senha', 'conta', 'portal', 'acesso'],
  },
  {
    id: 'notificacoes-whatsapp',
    scope: 'BOTH',
    title: 'Notificacoes e WhatsApp',
    question: 'Quem recebe alertas diarios e por que pode falhar?',
    answer:
      'Alertas diarios podem atingir gestores e operadores conforme configuracao. Falhas comuns envolvem instancia Evolution desconectada, numero invalido ou servico indisponivel.',
    tags: ['whatsapp', 'notificacao', 'evolution', 'alerta'],
  },
  {
    id: 'ca-validacao',
    scope: 'CLIENTE',
    title: 'Validador de CA',
    question: 'Como validar se um CA e valido?',
    answer:
      'No painel da empresa existe card de validacao rapida. Digite o numero do CA para retorno imediato de valido ou nao valido.',
    route: '/portal',
    tags: ['ca', 'validacao', 'mte', 'painel'],
  },
  {
    id: 'erro-estoque-cobertura',
    scope: 'CLIENTE',
    title: 'Quando entrega nao libera',
    question: 'Por que nao consigo finalizar entrega?',
    answer:
      'Os bloqueios mais comuns sao falta de biometria ativa, necessidade sem item real vinculado, item sem estoque ou dado inconsistente no trabalhador.',
    route: '/portal/entregas',
    tags: ['erro', 'bloqueio', 'estoque', 'cobertura', 'entrega'],
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

function routeMatchScore(path: string | null, entry: SupportKnowledgeEntry) {
  if (!path) return 0;
  const p = normalize(path);
  const candidates = [entry.route, ...(entry.routeAlias ?? [])].filter(Boolean) as string[];
  for (const candidate of candidates) {
    const normalizedCandidate = candidate.replace(/\[[^\]]+\]/g, '[SEG]');
    const escaped = normalizedCandidate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regexSource = escaped.replace(/\[SEG\]/g, '[^/]+');
    const exact = new RegExp(`^${regexSource}$`, 'i');
    const prefix = new RegExp(`^${regexSource}(?:/|$)`, 'i');
    if (exact.test(path)) return 12;
    if (prefix.test(path)) return 9;
    const simplified = normalize(candidate.replace(/\[[^\]]+\]/g, ''));
    if (simplified && p.includes(simplified.replace(/\/{2,}/g, '/'))) return 6;
  }
  return 0;
}

export function searchSupportKnowledge(input: {
  query: string;
  scope: SupportScopeKind;
  currentPath?: string | null;
  limit?: number;
}): SupportKnowledgeEntry[] {
  const { query, scope, currentPath = null, limit = 4 } = input;
  return SUPPORT_KNOWLEDGE
    .filter((entry) => entry.scope === 'BOTH' || entry.scope === scope)
    .map((entry) => ({
      entry,
      score:
        score(query, entry.title) * 2 +
        score(query, entry.question) * 3 +
        score(query, entry.answer) * 2 +
        (entry.steps ?? []).reduce((sum, step) => sum + score(query, step), 0) +
        (entry.warnings ?? []).reduce((sum, warning) => sum + score(query, warning), 0) +
        entry.tags.reduce((sum, tag) => sum + score(query, tag) * 2, 0) +
        routeMatchScore(currentPath, entry) +
        (entry.scope === scope ? 8 : entry.scope === 'BOTH' ? 4 : 1),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.entry);
}
