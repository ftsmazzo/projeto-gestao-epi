import { OccupationalRiskCategory } from '@prisma/client';

export type DefaultRiskSeed = {
  name: string;
  category: OccupationalRiskCategory;
  description: string;
  aliases: string[];
};

export const DEFAULT_OCCUPATIONAL_RISK_SEEDS: DefaultRiskSeed[] = [
  {
    name: 'Ruido',
    category: OccupationalRiskCategory.FISICO,
    description: 'Exposicao a ruido ocupacional.',
    aliases: ['ruido', 'barulho', 'noise'],
  },
  {
    name: 'Calor',
    category: OccupationalRiskCategory.FISICO,
    description: 'Exposicao a calor / sobrecarga termica.',
    aliases: ['calor', 'termico'],
  },
  {
    name: 'Poeira',
    category: OccupationalRiskCategory.QUIMICO,
    description: 'Exposicao a poeiras e particulados.',
    aliases: ['poeira', 'particulados'],
  },
  {
    name: 'Produto quimico',
    category: OccupationalRiskCategory.QUIMICO,
    description: 'Contato ou inalacao de produtos quimicos.',
    aliases: ['quimico', 'produto quimico', 'substancia quimica'],
  },
  {
    name: 'Agentes biologicos',
    category: OccupationalRiskCategory.BIOLOGICO,
    description: 'Exposicao a agentes biologicos.',
    aliases: ['biologico', 'virus', 'bacteria'],
  },
  {
    name: 'Posturas inadequadas',
    category: OccupationalRiskCategory.ERGONOMICO,
    description: 'Posturas inadequadas ou forcadas.',
    aliases: ['postura', 'posturas inadequadas'],
  },
  {
    name: 'Levantamento e transporte manual de peso',
    category: OccupationalRiskCategory.ERGONOMICO,
    description: 'Manuseio e transporte manual de cargas.',
    aliases: ['levantamento de peso', 'carga manual'],
  },
  {
    name: 'Repetitividade',
    category: OccupationalRiskCategory.ERGONOMICO,
    description: 'Movimentos repetitivos.',
    aliases: ['repetitivo', 'repetitividade'],
  },
  {
    name: 'Corte/perfuracao',
    category: OccupationalRiskCategory.MECANICO,
    description: 'Risco de corte ou perfuracao.',
    aliases: ['corte', 'perfuracao'],
  },
  {
    name: 'Queda de altura',
    category: OccupationalRiskCategory.ACIDENTE,
    description: 'Risco de queda em altura.',
    aliases: ['queda', 'trabalho em altura'],
  },
  {
    name: 'Colisao/atropelamento',
    category: OccupationalRiskCategory.ACIDENTE,
    description: 'Risco de colisao ou atropelamento.',
    aliases: ['colisao', 'atropelamento'],
  },
  {
    name: 'Fatores psicossociais',
    category: OccupationalRiskCategory.PSICOSSOCIAL,
    description: 'Fatores psicossociais no trabalho.',
    aliases: ['psicossocial', 'estresse'],
  },
];
