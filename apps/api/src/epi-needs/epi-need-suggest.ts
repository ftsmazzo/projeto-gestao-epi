import { EpiCategory } from '@prisma/client';

export type DefaultEpiNeedSeed = {
  name: string;
  category: EpiCategory;
  description: string;
  aliases: string[];
};

export const DEFAULT_EPI_NEED_SEEDS: DefaultEpiNeedSeed[] = [
  {
    name: 'Protetor Auricular Plug',
    category: EpiCategory.AUDITIVA,
    description: 'Protecao auditiva tipo plug/insercao.',
    aliases: ['plug', 'protetor auricular plug', 'auricular plug'],
  },
  {
    name: 'Protetor Auricular Concha',
    category: EpiCategory.AUDITIVA,
    description: 'Protecao auditiva tipo concha/abafador.',
    aliases: ['concha', 'abafador', 'protetor auricular concha'],
  },
  {
    name: 'Respirador PFF2',
    category: EpiCategory.RESPIRATORIA,
    description: 'Respirador descartavel PFF2 / N95 equivalente.',
    aliases: ['pff2', 'n95', 'respirador pff2'],
  },
  {
    name: 'Respirador Facial Inteira',
    category: EpiCategory.RESPIRATORIA,
    description: 'Peca facial inteira / full face.',
    aliases: ['facial inteira', 'full face', 'peca facial inteira'],
  },
  {
    name: 'Oculos de Seguranca',
    category: EpiCategory.OLHOS,
    description: 'Oculos de protecao ocular.',
    aliases: ['oculos', 'oculos de seguranca', 'protecao ocular'],
  },
  {
    name: 'Viseira Facial',
    category: EpiCategory.OLHOS,
    description: 'Protetor facial / viseira.',
    aliases: ['viseira', 'protetor facial', 'face shield'],
  },
  {
    name: 'Luva de Vaqueta',
    category: EpiCategory.MAOS,
    description: 'Luva de vaqueta / raspa para protecao das maos.',
    aliases: ['luva vaqueta', 'vaqueta', 'luva de raspa'],
  },
  {
    name: 'Luva Nitrilica',
    category: EpiCategory.MAOS,
    description: 'Luva nitrilica descartavel ou reutilizavel.',
    aliases: ['nitrilica', 'luva nitrilo', 'nitrilo'],
  },
  {
    name: 'Botina de Seguranca',
    category: EpiCategory.PES,
    description: 'Calcado de seguranca / botina.',
    aliases: ['botina', 'calcado de seguranca', 'bota de seguranca'],
  },
  {
    name: 'Capacete de Seguranca',
    category: EpiCategory.CABECA,
    description: 'Capacete de protecao da cabeca.',
    aliases: ['capacete', 'capacete de seguranca'],
  },
  {
    name: 'Cinto de Seguranca',
    category: EpiCategory.QUEDA,
    description: 'Cinto para trabalho em altura.',
    aliases: ['cinto de seguranca', 'cinto paraquedista'],
  },
  {
    name: 'Talabarte',
    category: EpiCategory.QUEDA,
    description: 'Talabarte / elemento de ligacao para queda.',
    aliases: ['talabarte'],
  },
  {
    name: 'Cinta Lombar',
    category: EpiCategory.TRONCO,
    description: 'Cinta lombar / suporte lombar.',
    aliases: ['cinta lombar', 'lombar'],
  },
  {
    name: 'Avental de Raspa',
    category: EpiCategory.TRONCO,
    description: 'Avental de raspa / couro.',
    aliases: ['avental', 'avental de raspa'],
  },
  {
    name: 'Creme Protetor',
    category: EpiCategory.OUTROS,
    description: 'Creme protetor / barreira cutanea.',
    aliases: ['creme protetor', 'creme de protecao'],
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
  if (hasAny('pff2', 'n95') || (has('respirador') && has('pff'))) {
    matched.add('Respirador PFF2');
  }
  if (
    has('respirador') &&
    hasAny('facial inteira', 'peca facial inteira', 'full face', 'inteira')
  ) {
    matched.add('Respirador Facial Inteira');
  }
  if (hasAny('oculos', 'oculo') && !has('viseira')) {
    matched.add('Oculos de Seguranca');
  }
  if (hasAny('viseira', 'protetor facial', 'face shield')) {
    matched.add('Viseira Facial');
  }
  if (has('luva') && hasAny('vaqueta', 'raspa')) {
    matched.add('Luva de Vaqueta');
  }
  if (has('luva') && hasAny('nitril', 'nitrilo')) {
    matched.add('Luva Nitrilica');
  }
  if (hasAny('botina', 'calcado', 'bota de seguranca', 'sapato de seguranca')) {
    matched.add('Botina de Seguranca');
  }
  if (has('capacete')) {
    matched.add('Capacete de Seguranca');
  }
  if (has('talabarte')) {
    matched.add('Talabarte');
  }
  if (has('cinto') && hasAny('seguranca', 'paraquedista', 'altura')) {
    matched.add('Cinto de Seguranca');
  }
  if (hasAny('cinta lombar', 'lombar')) {
    matched.add('Cinta Lombar');
  }
  if (has('avental') && hasAny('raspa', 'couro')) {
    matched.add('Avental de Raspa');
  } else if (has('avental')) {
    matched.add('Avental de Raspa');
  }
  if (has('creme') && hasAny('protetor', 'protecao', 'barreira')) {
    matched.add('Creme Protetor');
  }

  return [...matched];
}
