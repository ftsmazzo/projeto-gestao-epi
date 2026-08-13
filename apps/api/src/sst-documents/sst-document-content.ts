export const DEFAULT_INTEGRATION_TOPICS = [
  'Introducao a Seguranca do Trabalho',
  'Prevencao de Acidentes e Doencas Ocupacionais',
  'Identificacao e Avaliacao de Riscos no Ambiente',
  'Higiene e Saude no Ambiente de Trabalho',
  'Equipamentos de Protecao Individual (EPIs)',
  'Procedimentos de Evacuacao Contra Incendios',
  'Treinamento e Uso de Equipamentos de Trabalho',
  'Comportamento e Cultura de Seguranca',
  'Primeiros Socorros e Procedimentos de Emergencia',
  'Sinalizacao de Seguranca',
  'Conduta Segura no Ambiente de Trabalho',
  'Trabalho em Altura (NR-35)',
  'Riscos Especificos por Setor ou Funcao',
  'Uso Correto de Produtos Quimicos',
  'Prevencao e Combate ao Assedio no Trabalho',
  'Ergonomia no Posto de Trabalho (NR-17)',
  'Prevencao ao Uso de Alcool e Drogas',
  'Protecao Contra Incendios (NR-23)',
  'Organizacao e Limpeza',
  'Operador de Empilhadeira / Atencao',
  'Acidentes de Trabalho e Trajeto',
  'Operador de Maquinas e Equipamentos (NR-12)',
  'Trabalho com Ponte Rolante (NR-11)',
  'Trabalho a Quente (NR-18 e NR-34)',
  'Seguranca em Instalacoes Eletricas (NR-10)',
  'Seguranca com Maquinas Rotativas (NR-12)',
  'Saude Mental e Bem-Estar no Trabalho',
  'Comunicacao de Acidentes (CAT)',
  'Responsabilidades do Trabalhador',
  'Proibido Uso de Celulares e Dispositivos Eletronicos',
  'Violencia no ambiente de trabalho',
  'Comportamento Seguro e Atitude Preventiva',
  'Compromisso com a Vida — Seguranca e Tudo',
  'Comunicacao eficaz no ambiente de trabalho',
] as const;

export const DEFAULT_INTEGRATION_OBJECTIVE =
  'A Integracao de Seguranca do Trabalho tem como objetivo orientar os trabalhadores recem-admitidos quanto as normas de Seguranca e Saude no Trabalho da empresa, bem como apresentar os riscos existentes no ambiente de trabalho e as medidas preventivas adotadas, conforme determina a NR-01 — Disposicoes Gerais e Gerenciamento de Riscos Ocupacionais (GRO/PGR).';

export const DEFAULT_OS_RECOMMENDATIONS = [
  'Cumprir as normas de Seguranca e Saude no Trabalho e as orientacoes estabelecidas pela empresa.',
  'Manter o posto de trabalho limpo, organizado e livre de materiais que possam provocar quedas, tropecos ou dificultar a circulacao.',
  'Nao utilizar equipamentos, ferramentas, cabos ou extensoes que apresentem danos, comunicando imediatamente qualquer irregularidade.',
  'Manter livres e desobstruidos os acessos aos extintores, hidrantes, quadros eletricos, corredores e saidas de emergencia.',
  'Nao remover, alterar ou inutilizar protecoes de maquinas, equipamentos ou dispositivos de seguranca.',
  'Nao operar maquinas, equipamentos ou ferramentas para os quais nao possua autorizacao, capacitacao ou treinamento especifico.',
  'Ao transitar pelo setor produtivo, respeitar a sinalizacao de seguranca e manter distancia segura das maquinas em operacao.',
  'Comunicar imediatamente qualquer condicao insegura, incidente, acidente ou situacao que possa colocar em risco a seguranca.',
  'Participar dos treinamentos, integracoes, DDS e demais acoes de SST promovidas pela empresa.',
  'Em caso de emergencia, interromper as atividades, seguir as rotas de fuga, dirigir-se ao ponto de encontro e cumprir as orientacoes da brigada.',
];

export const DEFAULT_OS_RESPONSIBILITIES = [
  'Cumprir as normas de Seguranca e Saude no Trabalho, bem como as orientacoes desta Ordem de Servico e os procedimentos internos da empresa.',
  'Executar as atividades com atencao, responsabilidade e de acordo com os procedimentos estabelecidos para a funcao.',
  'Zelar pela propria seguranca e pela dos demais trabalhadores, adotando comportamento preventivo.',
  'Comunicar imediatamente ao superior imediato qualquer condicao insegura, incidente, acidente, quase acidente ou irregularidade.',
  'Utilizar corretamente os equipamentos, ferramentas, mobiliarios e instalacoes disponibilizados pela empresa, zelando por sua conservacao.',
  'Participar dos treinamentos, integracoes e orientacoes de SST promovidos pela empresa.',
  'Colaborar com as medidas de prevencao estabelecidas, contribuindo para um ambiente de trabalho seguro e organizado.',
  'Comparecer ao setor responsavel sempre que solicitado para treinamentos, orientacoes, exames ocupacionais ou demais procedimentos de SST.',
];

export const DEFAULT_OS_OBSERVATIONS = [
  'E obrigatorio o cumprimento das orientacoes desta Ordem de Servico e das normas de SST adotadas pela empresa.',
  'Qualquer alteracao no processo, nas atividades, nos equipamentos, no ambiente ou nos riscos devera ser comunicada ao responsavel de SST para avaliacao e, se necessario, atualizacao desta O.S.',
  'Todo incidente, quase acidente, acidente, condicao insegura ou ato inseguro devera ser comunicado imediatamente ao superior imediato.',
  'As orientacoes desta O.S. nao esgotam as medidas de prevencao: o trabalhador deve observar as normas internas, procedimentos, treinamentos e as NRs vigentes.',
  'Caso venha a exercer atividade diversa da descrita, devera receber as orientacoes, treinamentos e EPIs especificos da nova atividade.',
  'Acidente de trajeto (residencia-trabalho ou vice-versa) devera ser comunicado a empresa o mais breve possivel.',
  'O descumprimento pode sujeitar o trabalhador as medidas disciplinares da legislacao trabalhista e das normas internas, sem prejuizo das demais responsabilidades legais.',
];

export const DEFAULT_EPCS = ['Extintor de incendio'];

export function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const value = raw.trim();
    const key = value.toLocaleLowerCase('pt-BR');
    if (!value || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

export function uniqueRisks<T extends { category: string; agent: string }>(
  risks: T[],
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const risk of risks) {
    const key = `${risk.category}|${risk.agent}`.toLocaleLowerCase('pt-BR');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(risk);
  }
  return out;
}

export function isGenericSource(value: string | null | undefined): boolean {
  const v = (value ?? '').trim().toLocaleLowerCase('pt-BR');
  return !v || v === 'pgro' || v === 'pgr' || v === 'ghe' || v === 'import';
}

export function riskCategoryLabel(category: string): string {
  const map: Record<string, string> = {
    FISICO: 'Fisico',
    QUIMICO: 'Quimico',
    BIOLOGICO: 'Biologico',
    ERGONOMICO: 'Ergonomico',
    MECANICO: 'Mecanico',
    ACIDENTE: 'Acidente',
    PSICOSSOCIAL: 'Psicossocial',
    OUTROS: 'Outros',
  };
  return map[category] ?? category;
}

export function formatDayBr(value: string | null | undefined): string {
  if (!value) return '—';
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  try {
    return new Date(value).toLocaleDateString('pt-BR');
  } catch {
    return value;
  }
}

export type SstDocumentPayload = {
  type: 'INTEGRACAO' | 'ORDEM_SERVICO';
  company: {
    legalName: string;
    tradeName: string | null;
    cnpj: string;
    city: string | null;
  };
  worker: {
    name: string;
    cpfMasked: string;
    registration: string | null;
    admissionDate: string | null;
    sectorName: string | null;
    jobFunctionName: string | null;
  };
  technicalResponsible: {
    name: string | null;
    registry: string | null;
  };
  integration: {
    date: string | null;
    time: string;
    durationHours: number;
    topics: string[];
  } | null;
  os: {
    environment: string | null;
    functionDescription: string | null;
    risks: Array<{
      category: string;
      agent: string;
      source: string | null;
      evaluation: string;
      exposure: string | null;
    }>;
    epis: string[];
    epcs: string[];
    recommendations: string[];
    responsibilities: string[];
    observations: string[];
  } | null;
  termText: string;
  generatedAt: string;
};

export function maskCpf(cpf: string | null | undefined): string {
  const d = (cpf ?? '').replace(/\D/g, '');
  if (d.length !== 11) return d ? `***${d.slice(-4)}` : '—';
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function formatCnpj(digits: string): string {
  const d = digits.replace(/\D/g, '');
  if (d.length !== 14) return digits;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export function buildIntegrationTerm(companyName: string): string {
  return [
    `Declaro para os devidos fins que recebi da empresa ${companyName}, por ocasiao de minha admissao, as instrucoes basicas de seguranca referentes as condicoes e meio ambiente de trabalho, uso adequado dos equipamentos de protecao individual (EPIs), informacoes sobre os equipamentos de protecao coletiva (EPCs) e os riscos profissionais relativos as minhas funcoes, conforme a NR-01.`,
    'Estou ciente das obrigacoes das Normas Regulamentadoras da Portaria n. 3.214/78 e das normas internas da empresa, bem como das penalidades pelo nao cumprimento, nos termos dos arts. 158 e 482, alinea h, da CLT e do item 1.4.1 da NR-01, podendo sofrer advertencia verbal, advertencia por escrito, suspensao ou demissao por justa causa.',
    'Estou ciente de que, ao termino dos servicos ou na rescisao do contrato, devolverei os EPIs ao setor competente, em condicoes de uso, considerando o tempo de utilizacao.',
  ].join(' ');
}

export function buildOsTerm(companyName: string, jobName: string): string {
  return [
    `Declaro para os devidos fins que recebi da empresa ${companyName} os treinamentos sobre as normas de Seguranca e Medicina do Trabalho e o conteudo desta Ordem de Servico da funcao ${jobName}, bem como os Equipamentos de Protecao Individual necessarios ao exercicio da atividade.`,
    'Estou ciente do disposto nos arts. 157 e 158 da CLT e de que constitui falta grave o descumprimento, conforme a Portaria SEPRT n. 915, de 30/07/2019, item 1.4.1, letra c, podendo sofrer advertencia verbal, advertencia por escrito, suspensao ou demissao por justa causa.',
  ].join(' ');
}
