export type SupportScopeKind = 'CONSULTORIA' | 'CLIENTE';

export type SupportKnowledgeEntryRecord = {
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

type SupportKbModule = {
  key: string;
  scope: SupportScopeKind;
  title: string;
  route: string;
  routeAlias?: string[];
  operationLead: string;
  checklist: string[];
  commonIssues: string[];
  metricFocus: string;
  tags: string[];
};

export const SUPPORT_KB_VERSION = 'v2-2026-09-16';

const GLOBAL_ENTRIES: SupportKnowledgeEntryRecord[] = [
  {
    id: 'global-visao-sistema',
    scope: 'BOTH',
    title: 'Visao geral do ProntEPI',
    question: 'Qual e o objetivo do ProntEPI?',
    answer:
      'O ProntEPI conecta implantacao da consultoria com operacao diaria do cliente, cobrindo estrutura, estoque, entrega, validade, evidencias e relatorios.',
    tags: ['visao geral', 'objetivo', 'modulos', 'implantacao', 'operacao'],
  },
  {
    id: 'global-papeis-acesso',
    scope: 'BOTH',
    title: 'Papeis e niveis de acesso',
    question: 'Qual a diferenca entre consultoria e cliente?',
    answer:
      'Consultoria implanta e governa padroes. Cliente executa operacao por CNPJ no portal com gestor e operadores.',
    tags: ['acesso', 'papel', 'consultoria', 'cliente', 'portal'],
  },
  {
    id: 'global-whatsapp-alertas',
    scope: 'BOTH',
    title: 'Notificacoes e WhatsApp',
    question: 'Por que notificacao pode falhar?',
    answer:
      'Falhas comuns envolvem instancia Evolution desconectada, numero invalido, bloqueio do provedor ou comunicacoes desabilitadas no ambiente.',
    tags: ['whatsapp', 'notificacao', 'evolution', 'alerta', 'falha'],
  },
  {
    id: 'global-biometria-regras',
    scope: 'BOTH',
    title: 'Biometria e evidencias',
    question: 'Como funciona biometria no sistema?',
    answer:
      'A biometria facial e usada para validar entregas e assinaturas em fluxos permitidos, com trilha de consentimento e evidencias.',
    tags: ['biometria', 'facial', 'consentimento', 'evidencia', 'lgpd'],
  },
  {
    id: 'global-ca-conceito',
    scope: 'BOTH',
    title: 'Conceito de CA e necessidade',
    question: 'Qual diferenca entre necessidade e EPI com CA?',
    answer:
      'Necessidade representa tipo funcional. EPI com CA representa item real de catalogo/estoque. O vinculo entre eles habilita cobertura operacional.',
    tags: ['ca', 'necessidade', 'catalogo', 'cobertura', 'estoque'],
  },
  {
    id: 'global-pdf-reemissao',
    scope: 'BOTH',
    title: 'PDF e reemissao',
    question: 'PDF mostra regra da epoca?',
    answer:
      'Sim. Fichas e comprovantes exibem data de emissao/reemissao e aviso sobre as regras vigentes no momento da geracao.',
    tags: ['pdf', 'ficha epi', 'comprovante', 'reemissao', 'regra'],
  },
];

const MODULES: SupportKbModule[] = [
  {
    key: 'dashboard',
    scope: 'CONSULTORIA',
    title: 'Dashboard da consultoria',
    route: '/dashboard',
    operationLead: 'Monitorar franquia, ocupacao e prioridades de implantacao.',
    checklist: ['Revisar vidas usadas x contratadas', 'Checar clientes ativos', 'Abrir gargalos da implantacao'],
    commonIssues: ['Franquia estourada', 'Cliente sem estrutura concluida', 'Operacao sem usuario liberado'],
    metricFocus: 'Vidas contratadas, alocadas, usadas e disponiveis.',
    tags: ['dashboard', 'franquia', 'vidas', 'consultoria'],
  },
  {
    key: 'clientes',
    scope: 'CONSULTORIA',
    title: 'Clientes atendidos',
    route: '/clientes',
    operationLead: 'Cadastrar e governar operacao por CNPJ.',
    checklist: ['Cadastrar CNPJ e razao social', 'Definir cota de vidas', 'Abrir workspace do cliente'],
    commonIssues: ['CNPJ duplicado', 'Cota insuficiente', 'Cliente inativo sem motivo'],
    metricFocus: 'Clientes ativos, cota alocada e utilizacao por cliente.',
    tags: ['clientes', 'cnpj', 'cadastro', 'cota'],
  },
  {
    key: 'workspace',
    scope: 'CONSULTORIA',
    title: 'Workspace do cliente',
    route: '/clientes/[id]',
    routeAlias: ['/clientes/[id]/estrutura', '/clientes/[id]/usuarios', '/clientes/[id]/unidades'],
    operationLead: 'Conduzir roteiro de implantacao completo por cliente.',
    checklist: ['Estrutura pronta', 'Trabalhadores cadastrados', 'Usuarios do portal liberados'],
    commonIssues: ['Etapa pulada no roteiro', 'Funcao sem necessidade de EPI', 'Usuario sem acesso'],
    metricFocus: 'Percentual de etapas concluidas por cliente.',
    tags: ['workspace', 'roteiro', 'implantacao', 'cliente'],
  },
  {
    key: 'importar-pgr',
    scope: 'CONSULTORIA',
    title: 'Importacao inicial de PGR',
    route: '/clientes/importar-pgro',
    operationLead: 'Importar PGR e validar estrutura extraida antes de confirmar.',
    checklist: ['Enviar arquivo correto', 'Revisar setores e funcoes', 'Confirmar apenas apos saneamento'],
    commonIssues: ['Setor errado', 'Funcao faltante', 'Cobertura fraca de extracao'],
    metricFocus: 'Setores/funcoes/riscos identificados com confianca.',
    tags: ['pgr', 'pgro', 'importacao', 'estrutura'],
  },
  {
    key: 'atualizar-pgr',
    scope: 'CONSULTORIA',
    title: 'Atualizacao de PGR',
    route: '/clientes/[id]/atualizar-pgro',
    operationLead: 'Atualizar estrutura existente sem perder consistencia operacional.',
    checklist: ['Comparar diferencas', 'Validar impacto em funcoes', 'Confirmar mudancas com criterio'],
    commonIssues: ['Arquivamento indevido', 'Duplicidade de funcao', 'Risco sem mapeamento'],
    metricFocus: 'Delta estrutural entre PGR anterior e novo.',
    tags: ['pgr', 'atualizacao', 'delta', 'funcoes'],
  },
  {
    key: 'grupos',
    scope: 'CONSULTORIA',
    title: 'Grupos empresariais',
    route: '/clientes/grupos',
    operationLead: 'Concentrar acesso de um usuario para varios CNPJs.',
    checklist: ['Definir grupo', 'Adicionar CNPJs', 'Validar escopo operacional por empresa'],
    commonIssues: ['Usuario sem permissao em CNPJ especifico', 'Grupo incompleto', 'Confusao entre escopo e estoque'],
    metricFocus: 'Clientes vinculados por grupo e usuarios habilitados.',
    tags: ['grupo', 'multicnpj', 'acesso', 'portal'],
  },
  {
    key: 'epis',
    scope: 'CONSULTORIA',
    title: 'Catalogo de EPIs',
    route: '/epis',
    operationLead: 'Manter base tecnica de EPIs para abastecer os clientes.',
    checklist: ['Validar CA', 'Ajustar vida util', 'Revisar vinculacao com necessidades'],
    commonIssues: ['CA vencido', 'Vida util incoerente', 'Item sem vinculacao'],
    metricFocus: 'Itens ativos, validade de CA e completude tecnica.',
    tags: ['epis', 'ca', 'catalogo', 'vida util'],
  },
  {
    key: 'needs',
    scope: 'CONSULTORIA',
    title: 'Necessidades de EPI',
    route: '/epi-needs',
    operationLead: 'Padronizar necessidades funcionais para cobertura consistente.',
    checklist: ['Consolidar nomes', 'Evitar duplicatas', 'Vincular itens reais'],
    commonIssues: ['Necessidade sem item vinculado', 'Alias conflitante', 'Nome ambigüo'],
    metricFocus: 'Necessidades com cobertura real e status de estoque.',
    tags: ['necessidade', 'cobertura', 'catalogo', 'vinculo'],
  },
  {
    key: 'config',
    scope: 'CONSULTORIA',
    title: 'Configuracoes',
    route: '/configuracoes',
    operationLead: 'Administrar equipe, contatos, marca e politicas da consultoria.',
    checklist: ['Revisar equipe ativa', 'Atualizar contatos oficiais', 'Validar configuracoes de seguranca'],
    commonIssues: ['Membro sem papel correto', 'Contato desatualizado', 'Politica inconsistente'],
    metricFocus: 'Usuarios ativos, contatos primarios e saude de configuracoes.',
    tags: ['configuracoes', 'equipe', 'contatos', 'governanca'],
  },
  {
    key: 'certificados',
    scope: 'CONSULTORIA',
    title: 'Certificados',
    route: '/certificados',
    routeAlias: ['/certificados/gerar'],
    operationLead: 'Emitir e controlar certificados de treinamento por turma.',
    checklist: ['Escolher template correto', 'Validar turma e data', 'Gerar e revisar documento'],
    commonIssues: ['Template desatualizado', 'Dados de turma incompletos', 'Controle numerico incorreto'],
    metricFocus: 'Emissoes por periodo e integridade dos registros.',
    tags: ['certificados', 'treinamento', 'turma', 'registro'],
  },
  {
    key: 'painel',
    scope: 'CLIENTE',
    title: 'Painel da empresa',
    route: '/portal',
    operationLead: 'Acompanhar indicadores diarios e abrir operacao rapida.',
    checklist: ['Revisar alertas', 'Abrir entregas pendentes', 'Consultar validador de CA quando necessario'],
    commonIssues: ['Alerta ignorado', 'Prioridade operacional invertida', 'Interpretacao incorreta de KPI'],
    metricFocus: 'Pontos de atencao, vidas e atividade recente.',
    tags: ['painel', 'kpi', 'alerta', 'portal'],
  },
  {
    key: 'entregas',
    scope: 'CLIENTE',
    title: 'Entregas',
    route: '/portal/entregas',
    routeAlias: ['/portal/entregas/[id]'],
    operationLead: 'Executar entrega com rastreabilidade e evidencia correta.',
    checklist: ['Selecionar trabalhador', 'Conferir itens e estoque', 'Finalizar com assinatura'],
    commonIssues: ['Sem biometria ativa', 'Sem estoque', 'Item sem cobertura'],
    metricFocus: 'Entregas concluidas, bloqueios e devolucoes.',
    tags: ['entrega', 'assinatura', 'evidencia', 'estoque'],
  },
  {
    key: 'entrega-extra',
    scope: 'CLIENTE',
    title: 'Entrega extra por CA',
    route: '/portal/entregas',
    operationLead: 'Registrar itens extras fora da indicacao normativa quando aplicavel.',
    checklist: ['Marcar item extra', 'Selecionar item por CA', 'Registrar justificativa operacional'],
    commonIssues: ['Item extra sem CA valido', 'Confusao com item normativo', 'Quantidade inconsistente'],
    metricFocus: 'Volume de extras e impacto no consumo.',
    tags: ['extra', 'ca', 'entrega', 'fora indicacao'],
  },
  {
    key: 'assinatura-remota',
    scope: 'CLIENTE',
    title: 'Assinatura remota',
    route: '/portal/entregas',
    operationLead: 'Enviar link para assinatura no celular antes do fluxo presencial.',
    checklist: ['Disparar link', 'Aguardar assinatura', 'Usar fallback presencial se necessario'],
    commonIssues: ['Link expirado', 'Telefone invalido', 'Assinatura nao concluida'],
    metricFocus: 'Taxa de conclusao remota vs fallback presencial.',
    tags: ['assinatura', 'link', 'remota', 'whatsapp'],
  },
  {
    key: 'estoque',
    scope: 'CLIENTE',
    title: 'Estoque',
    route: '/portal/estoque',
    operationLead: 'Controlar entradas, saldos e cobertura de necessidades.',
    checklist: ['Registrar entrada', 'Verificar saldo baixo', 'Ajustar vinculacao need-item'],
    commonIssues: ['Saldo negativo', 'Entrada sem padrao', 'Item sem vinculo'],
    metricFocus: 'Saldo por item, baixo estoque e cobertura.',
    tags: ['estoque', 'entrada', 'saldo', 'cobertura'],
  },
  {
    key: 'custos',
    scope: 'CLIENTE',
    title: 'Custos',
    route: '/portal/custos',
    operationLead: 'Acompanhar custo de compra, entrega e saldo valorizado.',
    checklist: ['Anexar nota', 'Revisar extracao', 'Conferir custo unitario'],
    commonIssues: ['OCR ruim', 'Linha sem quantidade', 'Preco unitario incorreto'],
    metricFocus: 'Valor comprado, entregue e estoque precificado.',
    tags: ['custos', 'nota fiscal', 'valor', 'ocr'],
  },
  {
    key: 'trabalhadores',
    scope: 'CLIENTE',
    title: 'Trabalhadores',
    route: '/portal/trabalhadores',
    routeAlias: ['/portal/trabalhadores/[id]/ficha-epi'],
    operationLead: 'Gerenciar cadastro, biometria e historico de entrega por trabalhador.',
    checklist: ['Cadastrar dados corretos', 'Garantir biometria valida', 'Revisar ficha de EPI'],
    commonIssues: ['Setor/funcao vazio', 'Biometria revogada', 'Dados de contato desatualizados'],
    metricFocus: 'Trabalhadores ativos com biometria e cobertura.',
    tags: ['trabalhador', 'biometria', 'ficha', 'cadastro'],
  },
  {
    key: 'documentos-sst',
    scope: 'CLIENTE',
    title: 'Documentos SST',
    route: '/portal/documentos-sst',
    operationLead: 'Emitir e acompanhar assinatura de Integracao e Ordem de Servico.',
    checklist: ['Gerar documento', 'Enviar link', 'Monitorar status de assinatura'],
    commonIssues: ['Perfil SST incompleto', 'Link expirado', 'Dados de trabalhador inconsistentes'],
    metricFocus: 'Documentos pendentes, assinados e cancelados.',
    tags: ['sst', 'integracao', 'os', 'assinatura'],
  },
  {
    key: 'estrutura',
    scope: 'CLIENTE',
    title: 'Estrutura',
    route: '/portal/estrutura',
    routeAlias: ['/portal/estrutura/atualizar-pgr'],
    operationLead: 'Visualizar coerencia entre PGR, setores, funcoes, riscos e necessidades.',
    checklist: ['Conferir setores ativos', 'Validar funcoes', 'Auditar necessidades por risco'],
    commonIssues: ['Funcao sem risco', 'Need sem item real', 'Setor desatualizado'],
    metricFocus: 'Cobertura estrutural e aderencia ao PGR vigente.',
    tags: ['estrutura', 'setor', 'funcao', 'risco'],
  },
  {
    key: 'validade',
    scope: 'CLIENTE',
    title: 'Validade',
    route: '/portal/validade',
    operationLead: 'Antecipar trocas por CA e vida util.',
    checklist: ['Revisar vencidos', 'Planejar proximas trocas', 'Ajustar cadastro de vida util'],
    commonIssues: ['CA expirado em uso', 'Sem vida util cadastrada', 'Reposicao atrasada'],
    metricFocus: 'Itens vencidos, proximos e disponibilidade de substituicao.',
    tags: ['validade', 'reposicao', 'ca', 'alerta'],
  },
  {
    key: 'relatorios',
    scope: 'CLIENTE',
    title: 'Relatorios',
    route: '/portal/relatorios',
    operationLead: 'Medir performance operacional por periodo, setor e trabalhador.',
    checklist: ['Aplicar filtros corretos', 'Comparar periodos', 'Exportar insumos de decisao'],
    commonIssues: ['Filtro incoerente', 'Leitura sem contexto', 'Indicador sem acao'],
    metricFocus: 'Entregas, devolucoes, cobertura, reposicoes e atividade.',
    tags: ['relatorio', 'indicador', 'filtro', 'atividade'],
  },
  {
    key: 'conta',
    scope: 'CLIENTE',
    title: 'Minha conta',
    route: '/portal/conta',
    operationLead: 'Manter credencial de acesso segura e atualizada.',
    checklist: ['Trocar senha temporaria', 'Confirmar acesso ativo', 'Revisar dados pessoais'],
    commonIssues: ['Senha fraca', 'Senha temporaria nao trocada', 'Duvida de permissao'],
    metricFocus: 'Saude de acesso e conformidade de credenciais.',
    tags: ['conta', 'senha', 'acesso', 'seguranca'],
  },
];

const SPECIAL_ENTRIES: SupportKnowledgeEntryRecord[] = [
  {
    id: 'special-novo-cliente-manual-ou-pgr',
    scope: 'CONSULTORIA',
    title: 'Novo cliente: caminho manual ou via PGR',
    question: 'Como cadastrar cliente novo com PGR e sem PGR?',
    answer:
      'Voce tem dois caminhos validos: cadastro manual em Clientes ou implantacao via Importar PGR.',
    route: '/clientes',
    routeAlias: ['/clientes/importar-pgro'],
    steps: [
      'Manual: abra [Clientes](/clientes), clique em "Novo cliente" e preencha razao social, CNPJ e franquia inicial.',
      'Via PGR: abra [Importar PGR](/clientes/importar-pgro), envie o arquivo e confirme a estrutura antes de concluir.',
      'Depois acesse o workspace do cliente para validar trabalhadores e usuarios do portal.',
    ],
    tags: ['novo cliente', 'importar pgr', 'cadastro manual', 'onboarding'],
  },
  {
    id: 'special-trabalhador-importar-planilha',
    scope: 'CLIENTE',
    title: 'Trabalhador por planilha CSV',
    question: 'Como inserir trabalhadores por planilha?',
    answer:
      'Na tela de Trabalhadores existe fluxo de lote por CSV com preview e confirmacao.',
    route: '/portal/trabalhadores',
    steps: [
      'Acesse [Trabalhadores](/portal/trabalhadores).',
      'Clique no botao "Importar CSV".',
      'Clique em "Baixar modelo CSV", preencha a planilha e use "Selecionar CSV".',
      'Revise a previa e finalize em "Confirmar importacao".',
    ],
    warnings: [
      'Setor e funcao precisam existir na estrutura.',
      'Linhas com erro nao entram na confirmacao.',
    ],
    tags: ['trabalhador', 'planilha', 'csv', 'importacao em lote'],
  },
  {
    id: 'special-atualizar-base-caeip-botao',
    scope: 'CONSULTORIA',
    title: 'Atualizar catalogo CAEPI pelo botao correto',
    question: 'Como atualizar o catalogo de EPI oficial?',
    answer:
      'Para atualizar a base oficial, use o botao de manutencao da tela de Catalogo de EPIs.',
    route: '/epis',
    steps: [
      'Abra [Catalogo de EPIs](/epis).',
      'Na secao "Manutencao da base", clique em "Atualizar base oficial agora".',
      'Aguarde a mensagem de inicio da atualizacao e recarregue o status.',
    ],
    warnings: [
      'Esse fluxo atualiza a base CAEPI, nao edita um item individual.',
    ],
    tags: ['atualizar catalogo', 'caepi', 'botao atualizar', 'base oficial'],
  },
];

function moduleId(scope: SupportScopeKind, key: string, suffix: string) {
  return `${scope.toLowerCase()}-${key}-${suffix}`;
}

function buildModuleEntries(module: SupportKbModule): SupportKnowledgeEntryRecord[] {
  const baseTags = [...module.tags, module.scope.toLowerCase(), 'kb-v2'];
  return [
    {
      id: moduleId(module.scope, module.key, 'operacao'),
      scope: module.scope,
      title: `${module.title} - como operar`,
      question: `Como operar ${module.title.toLowerCase()} de forma correta?`,
      answer: `${module.operationLead} Comece pela tela ${module.route} e execute o fluxo com conferencia de dados antes de confirmar.`,
      route: module.route,
      routeAlias: module.routeAlias,
      tags: [...baseTags, 'operacao'],
    },
    {
      id: moduleId(module.scope, module.key, 'checklist'),
      scope: module.scope,
      title: `${module.title} - checklist`,
      question: `Qual checklist devo seguir em ${module.title.toLowerCase()}?`,
      answer: `Use um checklist operacional para reduzir erro de execucao em ${module.title.toLowerCase()}.`,
      route: module.route,
      routeAlias: module.routeAlias,
      steps: module.checklist,
      tags: [...baseTags, 'checklist'],
    },
    {
      id: moduleId(module.scope, module.key, 'erros'),
      scope: module.scope,
      title: `${module.title} - erros comuns`,
      question: `Quais erros mais comuns em ${module.title.toLowerCase()}?`,
      answer: `Os principais desvios acontecem por falta de conferencia antes de salvar ou por dados de origem inconsistentes.`,
      route: module.route,
      routeAlias: module.routeAlias,
      warnings: module.commonIssues,
      tags: [...baseTags, 'erros'],
    },
    {
      id: moduleId(module.scope, module.key, 'indicadores'),
      scope: module.scope,
      title: `${module.title} - indicadores`,
      question: `Quais indicadores acompanhar em ${module.title.toLowerCase()}?`,
      answer: `${module.metricFocus} Use esses sinais para priorizar acao de curto prazo.`,
      route: module.route,
      routeAlias: module.routeAlias,
      tags: [...baseTags, 'indicador', 'kpi'],
    },
  ];
}

export const SUPPORT_KB_MODULES = MODULES;

export const SUPPORT_KB_V2_ENTRIES: SupportKnowledgeEntryRecord[] = [
  ...GLOBAL_ENTRIES,
  ...SPECIAL_ENTRIES,
  ...MODULES.flatMap((module) => buildModuleEntries(module)),
];

