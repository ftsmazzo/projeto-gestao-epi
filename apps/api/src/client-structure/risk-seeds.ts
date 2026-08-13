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
    aliases: [
      'quimico',
      'produto quimico',
      'substancia quimica',
      'fumos metalicos',
      'fumos de solda',
      'fumos',
    ],
  },
  {
    name: 'Radiacao nao ionizante',
    category: OccupationalRiskCategory.FISICO,
    description: 'Radiacao solar / solda / nao ionizante.',
    aliases: [
      'radiacao nao ionizante',
      'luz solar',
      'radiacao solar',
      'radiacao',
      'uv de solda',
    ],
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
    aliases: ['queda de altura', 'queda em altura', 'trabalho em altura'],
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
  {
    name: 'Frio',
    category: OccupationalRiskCategory.FISICO,
    description: 'Exposicao a frio / baixa temperatura.',
    aliases: ['frio', 'baixa temperatura', 'camara fria'],
  },
  {
    name: 'Umidade',
    category: OccupationalRiskCategory.FISICO,
    description: 'Exposicao a umidade, agua ou areas molhadas.',
    aliases: ['umidade', 'area molhada', 'agua'],
  },
  {
    name: 'Vibracao',
    category: OccupationalRiskCategory.FISICO,
    description: 'Vibracao de corpo inteiro ou localizada (maos/bracos).',
    aliases: ['vibracao', 'vibracao de corpo inteiro', 'vibracao localizada'],
  },
  {
    name: 'Impacto nos olhos',
    category: OccupationalRiskCategory.ACIDENTE,
    description: 'Projecao de particulas ou impacto nos olhos.',
    aliases: [
      'impacto nos olhos',
      'projecao de particulas',
      'particula nos olhos',
    ],
  },
  {
    name: 'Queda de objetos',
    category: OccupationalRiskCategory.ACIDENTE,
    description: 'Queda de materiais ou ferramentas sobre a cabeca/corpo.',
    aliases: [
      'queda de objetos',
      'queda de materiais',
      'impacto na cabeca',
    ],
  },
  {
    name: 'Queda no mesmo nivel',
    category: OccupationalRiskCategory.ACIDENTE,
    description: 'Escorregao, tropeco ou queda no mesmo nivel.',
    aliases: [
      'queda no mesmo nivel',
      'escorregao',
      'tropeco',
      'superficie escorregadia',
    ],
  },
  {
    name: 'Eletricidade',
    category: OccupationalRiskCategory.ACIDENTE,
    description: 'Choque eletrico / contato com energia eletrica.',
    aliases: [
      'eletricidade',
      'choque eletrico',
      'risco eletrico',
      'energia eletrica',
    ],
  },
  {
    name: 'Maquinas e equipamentos',
    category: OccupationalRiskCategory.MECANICO,
    description: 'Contato com partes moveis de maquinas e equipamentos.',
    aliases: [
      'maquinas e equipamentos',
      'maquina',
      'equipamento mecanico',
      'parte movel',
    ],
  },
  {
    name: 'Incendio/explosao',
    category: OccupationalRiskCategory.ACIDENTE,
    description: 'Risco de incendio ou explosao.',
    aliases: ['incendio', 'explosao', 'atmosfera explosiva'],
  },
];
