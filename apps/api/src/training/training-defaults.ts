export type TrainingDefaultSeed = {
  name: string;
  courseTitle: string;
  nrLabel: string;
  defaultHours: number;
  defaultLocation: string;
  certificateCourseClause: string;
  topics: string[];
  registerSummary: string;
  instructorRole: string;
};

export const TRAINING_DEFAULT_SEEDS: TrainingDefaultSeed[] = [
  {
    name: 'Integração NR-01',
    courseTitle: 'Curso de NR. 01 - Integração de Segurança do Trabalho',
    nrLabel: 'NR.01',
    defaultHours: 6,
    defaultLocation: 'Sala de Treinamento',
    certificateCourseClause:
      'Frequentou o Curso de Integração de Segurança no Trabalho de Acordo Com a Legislação da Norma Regulamentadora / NR.01, Item 1.7 e Portaria SEPTR 1.295/2021',
    topics: [
      'Normas e Regulamentos Aplicáveis ao Trabalho na Indústria da Construção',
      'Informações Sobre As Condições E Meio Ambiente Do Trabalho',
      'Riscos Inerentes As Funções E Comportamentos E Atitudes',
      'Uso Adequado Do Equipamento De Proteção Individual (EPI)',
      'Informações Sobre Os Equipamentos De Proteção Coletiva (EPC)',
      'Prevenção De Acidentes Do Trabalho',
      'Prevenção De Acidente De Trajeto',
      'Realização Do Exame Médico Admissional (Sua Importância)',
      'Ordem De Serviço',
      'Higiene Ocupacional',
      'Direitos E Deveres Dos Trabalhadores',
      'Máquinas E Equipamentos (Qualificação E Autorização Na Operação)',
      'Cuidados No Processo De Trabalho',
    ],
    registerSummary:
      'Objetivo é capacitar todos os funcionários que receberão orientações dos riscos existentes no ambiente de trabalho, noções básicas de Segurança do trabalho entre outras informações como conduta serão feitas, de modo a garantir que todos os novos funcionários estarão cientes de seus deveres e aptos a desenvolver suas atividades de forma a garantir permanentemente a segurança e a saúde.',
    instructorRole: 'Técnico em Segurança do Trabalho',
  },
  {
    name: 'Trabalho em Altura NR-35',
    courseTitle: 'Curso de Altura NR. 35',
    nrLabel: 'NR.35',
    defaultHours: 8,
    defaultLocation: 'Sala de Treinamento',
    certificateCourseClause:
      'Frequentou o Curso de Capacitação de Trabalho em Altura de Acordo Com a Norma Regulamentadora / NR. 35.4',
    topics: [
      'Normas e Regulamentos Aplicáveis ao Trabalho em Altura',
      'Análise De Risco e Condições Impeditivas',
      'Riscos Potenciais Inerentes Ao Trabalho Em Altura E Medidas De Prevenção E Controle',
      'Sistemas, Equipamentos E Procedimentos De Proteção Coletiva',
      'Equipamentos De Proteção Individual Para Trabalho Em Altura: Seleção, Inspeção, Conservação E Limitação De Uso',
      'Acidentes Típicos Em Trabalhos Em Altura',
      'Condutas Em Situações De Emergência, Incluindo Noções De Técnicas De Resgate E De Primeiros Socorros',
    ],
    registerSummary:
      'O curso tem como objetivo instruir sobre a norma NR 35 Trabalho em Altura, que estabelece os requisitos mínimos e as medidas de proteção para o Trabalho em Altura, envolvendo o planejamento, organização e execução, de forma a garantir a segurança e a saúde dos trabalhadores envolvidos direta ou indiretamente com esta atividade.',
    instructorRole: 'Técnico em Segurança do Trabalho',
  },
];
