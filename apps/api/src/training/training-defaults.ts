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
    name: 'Integracao NR-01',
    courseTitle: 'Curso de NR. 01 - Integracao de Seguranca do Trabalho',
    nrLabel: 'NR.01',
    defaultHours: 6,
    defaultLocation: 'Sala de Treinamento',
    certificateCourseClause:
      'Frequentou o Curso de Integracao de Seguranca no Trabalho de Acordo Com a Legislacao da Norma Regulamentadora / NR.01, Item 1.7 e Portaria SEPTR 1.295/2021',
    topics: [
      'Normas e Regulamentos Aplicaveis ao Trabalho na Industria da Construcao',
      'Informacoes Sobre As Condicoes E Meio Ambiente Do Trabalho',
      'Riscos Inerentes As Funcoes E Comportamentos E Atitudes',
      'Uso Adequado Do Equipamento De Protecao Individual (EPI)',
      'Informacoes Sobre Os Equipamentos De Protecao Coletiva (EPC)',
      'Prevencao De Acidentes Do Trabalho',
      'Prevencao De Acidente De Trajeto',
      'Realizacao Do Exame Medico Admissional (Sua Importancia)',
      'Ordem De Servico',
      'Higiene Ocupacional',
      'Direitos E Deveres Dos Trabalhadores',
      'Maquinas E Equipamentos (Qualificacao E Autorizacao Na Operacao)',
      'Cuidados No Processo De Trabalho',
    ],
    registerSummary:
      'Objetivo e capacitar todos os funcionarios que receberao orientacoes dos riscos existentes no ambiente de trabalho, nocoes basicas de Seguranca do trabalho entre outras informacoes como conduta serao feitas, de modo a garantir que todos os novos funcionarios estarao cientes de seus deveres e aptos a desenvolver suas atividades de forma a garantir permanentemente a seguranca e a saude.',
    instructorRole: 'Tecnico em Seguranca do Trabalho',
  },
  {
    name: 'Trabalho em Altura NR-35',
    courseTitle: 'Curso de Altura NR. 35',
    nrLabel: 'NR.35',
    defaultHours: 8,
    defaultLocation: 'Sala de Treinamento',
    certificateCourseClause:
      'Frequentou o Curso de Capacitacao de Trabalho em Altura de Acordo Com a Norma Regulamentadora / NR. 35.4',
    topics: [
      'Normas e Regulamentos Aplicaveis ao Trabalho em Altura',
      'Analise De Risco e Condicoes Impeditivas',
      'Riscos Potenciais Inerentes Ao Trabalho Em Altura E Medidas De Prevencao E Controle',
      'Sistemas, Equipamentos E Procedimentos De Protecao Coletiva',
      'Equipamentos De Protecao Individual Para Trabalho Em Altura: Selecao, Inspecao, Conservacao E Limitacao De Uso',
      'Acidentes Tipicos Em Trabalhos Em Altura',
      'Condutas Em Situacoes De Emergencia, Incluindo Nocoes De Tecnicas De Resgate E De Primeiros Socorros',
    ],
    registerSummary:
      'O curso tem como objetivo instruir sobre a norma NR 35 Trabalho em Altura, que estabelece os requisitos minimos e as medidas de protecao para o Trabalho em Altura, envolvendo o planejamento, organizacao e execucao, de forma a garantir a seguranca e a saude dos trabalhadores envolvidos direta ou indiretamente com esta atividade.',
    instructorRole: 'Tecnico em Seguranca do Trabalho',
  },
];
