import { EpiCategory, EpiUsefulLifeUnit } from '@prisma/client';

export type DefaultEpiNeedSeed = {
  name: string;
  category: EpiCategory;
  description: string;
  aliases: string[];
  usefulLifeValue: number;
  usefulLifeUnit: EpiUsefulLifeUnit;
};

/**
 * Padrao operacional ProntEPI (dia corrido).
 * Nao e tabela oficial MTE/CAEPI — CA so valida certificado.
 * Quando fontes discordam, usa o prazo mais conservador ainda realista.
 * "Indeterminado" vira 5 anos (prazo tipico de fabricante) para a ficha ter data.
 */
export const DEFAULT_EPI_NEED_SEEDS: DefaultEpiNeedSeed[] = [
  {
    name: 'Protetor Auricular Plug',
    category: EpiCategory.AUDITIVA,
    description: 'Protecao auditiva tipo plug/insercao.',
    aliases: [
      'plug',
      'protetor auricular plug',
      'auricular plug',
      'protetor auditivo tipo plug',
    ],
    usefulLifeValue: 1,
    usefulLifeUnit: EpiUsefulLifeUnit.MESES,
  },
  {
    name: 'Protetor Auricular Concha',
    category: EpiCategory.AUDITIVA,
    description: 'Abafador tipo concha. 6 meses pelos coxins; casco pode durar mais.',
    aliases: [
      'concha',
      'abafador',
      'abafador de ruido',
      'protetor auricular concha',
      'protetor auditivo concha',
    ],
    usefulLifeValue: 6,
    usefulLifeUnit: EpiUsefulLifeUnit.MESES,
  },
  {
    name: 'Respirador PFF1',
    category: EpiCategory.RESPIRATORIA,
    description: 'Peca semifacial filtrante PFF1 / mascara contra po descartavel.',
    aliases: ['pff1', 'mascara contra po', 'mascara contra po descartavel'],
    usefulLifeValue: 3,
    usefulLifeUnit: EpiUsefulLifeUnit.DIAS,
  },
  {
    name: 'Respirador PFF2',
    category: EpiCategory.RESPIRATORIA,
    description: 'Respirador descartavel PFF2 / N95 equivalente.',
    aliases: [
      'pff2',
      'n95',
      'respirador pff2',
      'respirador purificador',
      'mascara pff',
      'mascara de protecao',
      'mascara de proteccao',
    ],
    usefulLifeValue: 3,
    usefulLifeUnit: EpiUsefulLifeUnit.DIAS,
  },
  {
    name: 'Respirador Facial Inteira',
    category: EpiCategory.RESPIRATORIA,
    description: 'Peca facial inteira / full face. Filtro/cartucho tem prazo proprio.',
    aliases: ['facial inteira', 'full face', 'peca facial inteira'],
    usefulLifeValue: 3,
    usefulLifeUnit: EpiUsefulLifeUnit.ANOS,
  },
  {
    name: 'Respirador de Fuga',
    category: EpiCategory.RESPIRATORIA,
    description: 'Respirador de fuga com filtro / escape.',
    aliases: [
      'respirador de fuga',
      'mascara de fuga',
      'fuga com filtro',
    ],
    usefulLifeValue: 1,
    usefulLifeUnit: EpiUsefulLifeUnit.ANOS,
  },
  {
    name: 'Mascara de Solda',
    category: EpiCategory.OLHOS,
    description: 'Mascara / escudo de solda (celeron ou similar).',
    aliases: ['mascara de solda', 'escudo de solda', 'solda celeron'],
    usefulLifeValue: 1,
    usefulLifeUnit: EpiUsefulLifeUnit.ANOS,
  },
  {
    name: 'Oculos de Seguranca',
    category: EpiCategory.OLHOS,
    description: 'Oculos de protecao (lente incolor ou escura, com protecao lateral).',
    aliases: [
      'oculos',
      'oculos de seguranca',
      'protecao ocular',
      'oculos lente incolor',
      'oculos lente escura',
      'oculos de protecao fume',
      'oculos com protecao lateral',
    ],
    usefulLifeValue: 6,
    usefulLifeUnit: EpiUsefulLifeUnit.MESES,
  },
  {
    name: 'Oculos de Ampla Visao',
    category: EpiCategory.OLHOS,
    description: 'Oculos de ampla visao / goggle.',
    aliases: ['ampla visao', 'oculos ampla visao', 'goggle'],
    usefulLifeValue: 1,
    usefulLifeUnit: EpiUsefulLifeUnit.ANOS,
  },
  {
    name: 'Viseira Facial',
    category: EpiCategory.OLHOS,
    description: 'Protetor facial / viseira acrilica.',
    aliases: [
      'viseira',
      'protetor facial',
      'face shield',
      'protetor facial acrilico',
    ],
    usefulLifeValue: 1,
    usefulLifeUnit: EpiUsefulLifeUnit.ANOS,
  },
  {
    name: 'Luva de Vaqueta',
    category: EpiCategory.MAOS,
    description: 'Luva de vaqueta para protecao mecanica das maos.',
    aliases: ['luva vaqueta', 'vaqueta'],
    usefulLifeValue: 3,
    usefulLifeUnit: EpiUsefulLifeUnit.MESES,
  },
  {
    name: 'Luva de Raspa',
    category: EpiCategory.MAOS,
    description: 'Luva de raspa (desgaste rapido em solda/corte).',
    aliases: ['luva de raspa', 'luva raspa'],
    usefulLifeValue: 15,
    usefulLifeUnit: EpiUsefulLifeUnit.DIAS,
  },
  {
    name: 'Luva de PVC',
    category: EpiCategory.MAOS,
    description: 'Luva de PVC lisa, granulada ou grafatex.',
    aliases: [
      'luva de pvc',
      'luva pvc',
      'grafatex',
      'luva de pvc granulada',
      'luva de pvc lisa',
    ],
    usefulLifeValue: 7,
    usefulLifeUnit: EpiUsefulLifeUnit.DIAS,
  },
  {
    name: 'Luva Nitrilica',
    category: EpiCategory.MAOS,
    description: 'Luva nitrilica reutilizavel de uso quimico. Descartavel: 1 dia.',
    aliases: ['nitrilica', 'luva nitrilo', 'nitrilo', 'sol-vex'],
    usefulLifeValue: 2,
    usefulLifeUnit: EpiUsefulLifeUnit.MESES,
  },
  {
    name: 'Luva Anticorte',
    category: EpiCategory.MAOS,
    description: 'Luva resistente a corte.',
    aliases: ['luva anticorte', 'luva anti-corte'],
    usefulLifeValue: 4,
    usefulLifeUnit: EpiUsefulLifeUnit.MESES,
  },
  {
    name: 'Luva de Malha Pigmentada',
    category: EpiCategory.MAOS,
    description: 'Luva de malha pigmentada / banho nitrilico leve.',
    aliases: [
      'luva de malha',
      'malha pigmentada',
      'luva pigmentada',
    ],
    usefulLifeValue: 1,
    usefulLifeUnit: EpiUsefulLifeUnit.MESES,
  },
  {
    name: 'Luva Isolante',
    category: EpiCategory.MAOS,
    description: 'Luva isolante eletrica (classe 00 e demais).',
    aliases: [
      'luva isolante',
      'luva isolante classe',
      'luva de borracha isolante',
    ],
    usefulLifeValue: 1,
    usefulLifeUnit: EpiUsefulLifeUnit.ANOS,
  },
  {
    name: 'Botina de Seguranca',
    category: EpiCategory.PES,
    description: 'Calcado de seguranca / botina (aco ou composite).',
    aliases: [
      'botina',
      'botina de seguranca',
      'calcado de seguranca',
      'bota de seguranca',
      'calcado de segurança',
      'botina de eletricista',
      'botina com biqueira',
    ],
    usefulLifeValue: 6,
    usefulLifeUnit: EpiUsefulLifeUnit.MESES,
  },
  {
    name: 'Bota de Borracha',
    category: EpiCategory.PES,
    description: 'Bota de borracha / PVC impermeavel.',
    aliases: [
      'bota de borracha',
      'botas de borracha',
      'bota de pvc',
      'bota impermeavel',
    ],
    usefulLifeValue: 6,
    usefulLifeUnit: EpiUsefulLifeUnit.MESES,
  },
  {
    name: 'Perneira de Raspa',
    category: EpiCategory.PES,
    description: 'Perneira de raspa / couro para solda e corte.',
    aliases: ['perneira', 'perneira de raspa', 'perneira de couro'],
    usefulLifeValue: 2,
    usefulLifeUnit: EpiUsefulLifeUnit.MESES,
  },
  {
    name: 'Capacete de Seguranca',
    category: EpiCategory.CABECA,
    description:
      'Capacete de protecao. 5 anos (casco, tipico de fabricante/ABNT), nao 1 ano de tabela generica.',
    aliases: ['capacete', 'capacete de seguranca', 'capacete com jugular'],
    usefulLifeValue: 5,
    usefulLifeUnit: EpiUsefulLifeUnit.ANOS,
  },
  {
    name: 'Cinto de Seguranca',
    category: EpiCategory.QUEDA,
    description:
      'Cinturao tipo paraquedista. Fabricante costuma limitar a 5 anos; inspecao a cada uso.',
    aliases: [
      'cinto de seguranca',
      'cinto paraquedista',
      'cinturao tipo paraquedista',
      'cinturao tipo para-quedista',
      'paraquedista',
    ],
    usefulLifeValue: 5,
    usefulLifeUnit: EpiUsefulLifeUnit.ANOS,
  },
  {
    name: 'Cinturao para Vigilante',
    category: EpiCategory.TRONCO,
    description: 'Cinturao / cinto operacional para vigilante (nao e paraquedista).',
    aliases: [
      'cinturao para vigilante',
      'cinturao vigilante',
      'cinto para vigilante',
    ],
    usefulLifeValue: 1,
    usefulLifeUnit: EpiUsefulLifeUnit.ANOS,
  },
  {
    name: 'Trava-quedas',
    category: EpiCategory.QUEDA,
    description: 'Dispositivo trava-quedas / retentor de queda.',
    aliases: ['trava quedas', 'trava-quedas', 'dispositivo trava'],
    usefulLifeValue: 5,
    usefulLifeUnit: EpiUsefulLifeUnit.ANOS,
  },
  {
    name: 'Talabarte',
    category: EpiCategory.QUEDA,
    description: 'Talabarte / elemento de ligacao (Y ou simples).',
    aliases: ['talabarte', 'talabarte y'],
    usefulLifeValue: 5,
    usefulLifeUnit: EpiUsefulLifeUnit.ANOS,
  },
  {
    name: 'Cinta Lombar',
    category: EpiCategory.TRONCO,
    description: 'Cinta lombar / suporte lombar.',
    aliases: ['cinta lombar', 'lombar'],
    usefulLifeValue: 6,
    usefulLifeUnit: EpiUsefulLifeUnit.MESES,
  },
  {
    name: 'Avental de Raspa',
    category: EpiCategory.TRONCO,
    description: 'Avental de raspa / couro.',
    aliases: ['avental de raspa', 'avental de couro'],
    usefulLifeValue: 2,
    usefulLifeUnit: EpiUsefulLifeUnit.MESES,
  },
  {
    name: 'Avental de PVC',
    category: EpiCategory.TRONCO,
    description: 'Avental de PVC / quimico.',
    aliases: ['avental de pvc', 'avental pvc'],
    usefulLifeValue: 30,
    usefulLifeUnit: EpiUsefulLifeUnit.DIAS,
  },
  {
    name: 'Avental Trevira',
    category: EpiCategory.TRONCO,
    description: 'Avental de trevira / termico leve.',
    aliases: ['avental trevira', 'trevira'],
    usefulLifeValue: 6,
    usefulLifeUnit: EpiUsefulLifeUnit.MESES,
  },
  {
    name: 'Manga de Raspa',
    category: EpiCategory.TRONCO,
    description: 'Manga, gola ou mangote de raspa.',
    aliases: [
      'manga de raspa',
      'gola de raspa',
      'mangote de raspa',
      'manga/gola de raspa',
    ],
    usefulLifeValue: 3,
    usefulLifeUnit: EpiUsefulLifeUnit.MESES,
  },
  {
    name: 'Manga Anticorte',
    category: EpiCategory.TRONCO,
    description: 'Manga / mangote resistente a corte.',
    aliases: ['manga anticorte', 'mangote anticorte'],
    usefulLifeValue: 1,
    usefulLifeUnit: EpiUsefulLifeUnit.ANOS,
  },
  {
    name: 'Capa de Chuva',
    category: EpiCategory.TRONCO,
    description: 'Capa de chuva / impermeavel.',
    aliases: ['capa de chuva'],
    usefulLifeValue: 3,
    usefulLifeUnit: EpiUsefulLifeUnit.MESES,
  },
  {
    name: 'Creme Protetor',
    category: EpiCategory.OUTROS,
    description: 'Creme protetor / barreira cutanea.',
    aliases: ['creme protetor', 'creme de protecao'],
    usefulLifeValue: 30,
    usefulLifeUnit: EpiUsefulLifeUnit.DIAS,
  },
];

function normalizeMatchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export type EpiNeedMatchInput = {
  name?: string | null;
  description?: string | null;
  category?: string | null;
  reference?: string | null;
  equipmentName?: string | null;
  color?: string | null;
  technicalNotes?: string | null;
};

/**
 * Sugere nomes de necessidades com base em texto do EPI/CAEPI.
 * Nao cria vinculo automatico — apenas candidatos.
 */
export function suggestNeedNamesFromText(input: EpiNeedMatchInput): string[] {
  const blob = normalizeMatchText(
    [
      input.name,
      input.description,
      input.category,
      input.reference,
      input.equipmentName,
      input.color,
      input.technicalNotes,
    ]
      .filter(Boolean)
      .join(' '),
  );

  if (!blob) return [];

  const matched = new Set<string>();

  const has = (...parts: string[]) => parts.every((p) => blob.includes(p));
  const hasAny = (...parts: string[]) => parts.some((p) => blob.includes(p));

  if (
    (has('protetor', 'auricular') || has('auditivo') || has('auricular')) &&
    hasAny('plug', 'insercao', 'inserto')
  ) {
    matched.add('Protetor Auricular Plug');
  }
  if (
    (has('protetor', 'auricular') || has('auditivo') || has('abafador')) &&
    hasAny('concha', 'abafador', 'shell')
  ) {
    matched.add('Protetor Auricular Concha');
  }
  if (hasAny('pff1') || (has('mascara') && hasAny('contra po', 'poeira'))) {
    matched.add('Respirador PFF1');
  }
  if (hasAny('pff2', 'n95') || (has('respirador') && has('pff'))) {
    matched.add('Respirador PFF2');
  }
  if (
    has('respirador') &&
    hasAny('facial inteira', 'peca facial inteira', 'full face')
  ) {
    matched.add('Respirador Facial Inteira');
  }
  if (hasAny('fuga') && hasAny('respirador', 'mascara', 'filtro')) {
    matched.add('Respirador de Fuga');
  }
  if (hasAny('ampla visao', 'goggle')) {
    matched.add('Oculos de Ampla Visao');
  } else if (hasAny('oculos', 'oculo') && !has('viseira')) {
    matched.add('Oculos de Seguranca');
  }
  if (hasAny('viseira', 'protetor facial', 'face shield')) {
    matched.add('Viseira Facial');
  }
  if (has('luva') && has('vaqueta')) {
    matched.add('Luva de Vaqueta');
  }
  if (has('luva') && has('raspa')) {
    matched.add('Luva de Raspa');
  }
  if (has('luva') && hasAny('pvc', 'grafatex')) {
    matched.add('Luva de PVC');
  }
  if (has('luva') && hasAny('nitril', 'nitrilo', 'sol-vex')) {
    matched.add('Luva Nitrilica');
  }
  if (has('luva') && hasAny('anticorte', 'anti-corte', 'anti corte')) {
    matched.add('Luva Anticorte');
  }
  if (has('luva') && has('malha')) {
    matched.add('Luva de Malha Pigmentada');
  }
  if (has('luva') && hasAny('isolante', 'classe 00', 'classe 0')) {
    matched.add('Luva Isolante');
  }
  if (hasAny('bota de borracha', 'bota de pvc', 'botas de borracha')) {
    matched.add('Bota de Borracha');
  } else if (
    hasAny('botina', 'calcado', 'bota de seguranca', 'sapato de seguranca')
  ) {
    matched.add('Botina de Seguranca');
  }
  if (has('capacete')) {
    matched.add('Capacete de Seguranca');
  }
  if (has('talabarte')) {
    matched.add('Talabarte');
  }
  if (hasAny('vigilante') && hasAny('cinto', 'cinturao')) {
    matched.add('Cinturao para Vigilante');
  } else if (has('cinto') && hasAny('seguranca', 'paraquedista', 'altura')) {
    matched.add('Cinto de Seguranca');
  } else if (has('cinturao') && hasAny('paraquedista', 'para-quedista')) {
    matched.add('Cinto de Seguranca');
  }
  if (hasAny('cinta lombar', 'lombar')) {
    matched.add('Cinta Lombar');
  }
  if (has('avental') && hasAny('pvc')) {
    matched.add('Avental de PVC');
  } else if (has('avental') && hasAny('trevira')) {
    matched.add('Avental Trevira');
  } else if (has('avental') && hasAny('raspa', 'couro')) {
    matched.add('Avental de Raspa');
  } else if (has('avental')) {
    matched.add('Avental de Raspa');
  }
  if (hasAny('manga', 'gola', 'mangote') && hasAny('anticorte', 'anti-corte')) {
    matched.add('Manga Anticorte');
  } else if (hasAny('manga', 'gola', 'mangote') && hasAny('raspa', 'couro')) {
    matched.add('Manga de Raspa');
  }
  if (hasAny('capa de chuva', 'impermeavel')) {
    matched.add('Capa de Chuva');
  }
  if (has('creme') && hasAny('protetor', 'protecao', 'barreira')) {
    matched.add('Creme Protetor');
  }
  if (has('perneira')) {
    matched.add('Perneira de Raspa');
  }
  if (hasAny('mascara de solda', 'escudo de solda')) {
    matched.add('Mascara de Solda');
  }
  if (hasAny('trava-quedas', 'trava quedas', 'dispositivo trava')) {
    matched.add('Trava-quedas');
  }

  return [...matched];
}
