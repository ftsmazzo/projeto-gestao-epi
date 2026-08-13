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
  'Riscos Especificos por Setor ou Funcao',
  'Ergonomia no Posto de Trabalho (NR-17)',
  'Organizacao e Limpeza',
  'Acidentes de Trabalho e Trajeto',
  'Comunicacao de Acidentes (CAT)',
  'Responsabilidades do Trabalhador',
  'Comportamento Seguro e Atitude Preventiva',
] as const;

export const DEFAULT_OS_RECOMMENDATIONS = [
  'Cumprir as normas de Seguranca e Saude no Trabalho e as orientacoes da empresa.',
  'Manter o posto de trabalho limpo, organizado e livre de materiais que possam provocar quedas.',
  'Nao operar maquinas, equipamentos ou ferramentas sem autorizacao, capacitacao ou treinamento.',
  'Nao remover, alterar ou inutilizar protecoes de maquinas e dispositivos de seguranca.',
  'Manter livres os acessos a extintores, hidrantes, corredores e saidas de emergencia.',
  'Comunicar imediatamente qualquer condicao insegura, incidente ou acidente.',
  'Participar das integracoes, treinamentos e DDS promovidos pela empresa.',
  'Em emergencia, interromper as atividades, seguir a rota de fuga e ir ao ponto de encontro.',
];

export const DEFAULT_OS_RESPONSIBILITIES = [
  'Cumprir esta Ordem de Servico e as normas internas de SST.',
  'Executar as atividades com atencao e conforme os procedimentos da funcao.',
  'Zelar pela propria seguranca e pela dos demais trabalhadores.',
  'Comunicar ao superior imediato qualquer irregularidade no ambiente de trabalho.',
  'Utilizar corretamente equipamentos, ferramentas e instalacoes da empresa.',
  'Comparecer quando solicitado para treinamentos, orientacoes ou exames ocupacionais.',
];

export const DEFAULT_EPCS = ['Extintor de incendio'];

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
    `Declaro que recebi da empresa ${companyName}, por ocasiao da minha admissao, as instrucoes basicas de seguranca referentes as condicoes e meio ambiente de trabalho, uso adequado dos EPIs, informacoes sobre EPCs e os riscos profissionais relativos as minhas funcoes, conforme a NR-01.`,
    'Estou ciente das obrigacoes das Normas Regulamentadoras e das normas internas da empresa, bem como das penalidades pelo nao cumprimento (advertencia verbal, advertencia por escrito, suspensao ou demissao por justa causa), nos termos dos arts. 158 e 482, alinea h, da CLT e do item 1.4.1 da NR-01.',
    'Ao termino dos servicos ou na rescisao, devolverei os EPIs ao setor competente, considerando o tempo de uso.',
  ].join(' ');
}

export function buildOsTerm(companyName: string, jobName: string): string {
  return [
    `Declaro que recebi da empresa ${companyName} a Ordem de Servico de Seguranca da funcao ${jobName}, com os treinamentos e os EPIs necessarios ao exercicio da atividade, ciente do disposto nos arts. 157 e 158 da CLT e no item 1.4.1 da NR-01.`,
    'O descumprimento constitui falta grave e pode ensejar advertencia verbal, advertencia por escrito, suspensao ou demissao por justa causa.',
  ].join(' ');
}
