/**
 * Monta fonte geradora, exposicao e avaliacao da O.S. a partir do PGR
 * (APRHO + descricao da atividade/ambiente do GHE) e de regras por agente.
 * Nao depende de preenchimento manual.
 */

export type OsRiskContextInput = {
  agent: string;
  category: string;
  jobName?: string | null;
  sectorName?: string | null;
  activity?: string | null;
  environment?: string | null;
  extractedSource?: string | null;
  extractedExposure?: string | null;
  extractedQuantitative?: string | null;
};

export type OsRiskContext = {
  source: string;
  exposure: string;
  evaluation: string;
  quantitative: string | null;
};

const GENERIC_SOURCE =
  /^(pgro|pgr|ghe|import|incluido na revisao|nao informado|n\/a|—|-)?$/i;

export function isGenericRiskSource(value: string | null | undefined): boolean {
  return GENERIC_SOURCE.test((value ?? '').trim());
}

export function compactPgrText(
  value: string | null | undefined,
  max = 140,
): string | null {
  if (!value) return null;
  const cleaned = value
    .replace(/executar outras tarefas[\s\S]*/i, '')
    .replace(/esta sob as responsabilidades[\s\S]{0,80}/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length < 8) return null;
  return cleaned.length > max ? `${cleaned.slice(0, max - 1).trim()}…` : cleaned;
}

export function extractAprhoAgentDetails(
  aprhoText: string,
  agentName: string,
  aliases: string[] = [],
): {
  source: string | null;
  exposure: string | null;
  quantitative: string | null;
} {
  const haystack = aprhoText.replace(/\s+/g, ' ');
  const names = [agentName, ...aliases].filter((n) => n.trim().length >= 3);
  let window = haystack;
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = haystack.match(new RegExp(escaped, 'i'));
    if (match?.index != null) {
      window = haystack.slice(
        Math.max(0, match.index - 100),
        match.index + name.length + 240,
      );
      break;
    }
  }

  const quantitative =
    window.match(/(\d{1,3}(?:[.,]\d{1,2})?\s*dB\s*\(?A\)?)/i)?.[1] ??
    window.match(
      /(\d{1,4}(?:[.,]\d{1,2})?\s*(?:ppm|mg\/m[³3]|lux|°\s*C|\bC\b))/i,
    )?.[1] ??
    null;

  let exposure: string | null = null;
  if (/habitual(?:\s+e\s+intermitente)?/i.test(window)) {
    exposure = 'Habitual e intermitente';
  } else if (/\bpermanente\b/i.test(window)) {
    exposure = 'Permanente';
  } else if (/\beventual\b/i.test(window)) {
    exposure = 'Eventual';
  } else if (/\bintermitente\b/i.test(window)) {
    exposure = 'Intermitente';
  }

  const fonteMatch = window.match(
    /fonte\s+geradora[:\s\-–]+(.{8,180}?)(?:forma\s+de\s+avali|tipo\s+de\s+expos|qualitativa|quantitativa|$)/i,
  );
  const source = compactPgrText(fonteMatch?.[1] ?? null, 160);

  return {
    source,
    exposure,
    quantitative: quantitative?.replace(/\s+/g, ' ').trim() ?? null,
  };
}

function agentKey(agent: string): string {
  return agent
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function inferFonteFromAgent(input: OsRiskContextInput): string {
  const key = agentKey(input.agent);
  const activity = compactPgrText(input.activity, 120);
  const environment = compactPgrText(input.environment, 80);
  const place =
    compactPgrText(input.sectorName, 40) ||
    compactPgrText(input.jobName, 40) ||
    'o local de trabalho';

  if (key.includes('ruido')) {
    return (
      [activity, environment, 'Circulacao em areas produtivas'].filter(Boolean)[0] ??
      'Circulacao em areas produtivas, movimentacao de materiais'
    );
  }
  if (key.includes('calor')) {
    return (
      environment ||
      activity ||
      'Processos termicos, exposicao solar ou areas produtivas'
    );
  }
  if (key.includes('frio')) {
    return environment || activity || 'Areas refrigeradas ou exposicao a baixa temperatura';
  }
  if (key.includes('umidade')) {
    return environment || activity || 'Areas molhadas, lavagem ou intemperie';
  }
  if (key.includes('vibracao')) {
    return activity || 'Operacao de maquinas, veiculos ou ferramentas vibratorias';
  }
  if (key.includes('radiacao')) {
    return activity || environment || 'Solda, luz solar ou fontes nao ionizantes';
  }
  if (key.includes('poeira')) {
    return activity || 'Movimentacao de materiais e processos produtivos';
  }
  if (key.includes('quimico') || key.includes('fumo')) {
    return activity || 'Manuseio de produtos quimicos, solda ou processos da funcao';
  }
  if (key.includes('biologic')) {
    return activity || environment || 'Contato com residuos, limpeza ou agentes biologicos';
  }
  if (key.includes('levantamento') || key.includes('peso') || key.includes('carga')) {
    return (
      activity ||
      'Movimentacao de caixas, pecas, materiais, volumes e produtos'
    );
  }
  if (key.includes('postura')) {
    return (
      activity ||
      'Abaixamento, alcance elevado, conferencia e organizacao do posto'
    );
  }
  if (key.includes('repetitiv')) {
    return activity || 'Movimentos repetitivos na execucao da funcao';
  }
  if (key.includes('psicossocial') || key.includes('estresse')) {
    return activity || 'Ritmo, metas, atendimento ou organizacao do trabalho';
  }
  if (key.includes('mesmo nivel') || key.includes('escorreg') || key.includes('tropec')) {
    return `Circulacao em ${place}, corredores, piso molhado ou materiais no caminho`;
  }
  if (key.includes('queda de objeto') || key.includes('queda de material')) {
    return (
      activity ||
      'Armazenamento em prateleiras, empilhamento e manuseio de pecas e volumes'
    );
  }
  if (key.includes('altura')) {
    return activity || environment || 'Trabalho em altura, escadas ou estruturas elevadas';
  }
  if (key.includes('corte') || key.includes('perfur')) {
    return activity || 'Manuseio de ferramentas, chapas e materiais cortantes';
  }
  if (key.includes('maquina') || key.includes('equipamento')) {
    return activity || 'Operacao e proximidade de maquinas e equipamentos';
  }
  if (key.includes('olho') || key.includes('particula')) {
    return activity || 'Projecao de particulas, poeira ou fragmentos';
  }
  if (key.includes('colisao') || key.includes('atropel') || key.includes('transito')) {
    return activity || environment || 'Circulacao de veiculos, pecas ou pessoas';
  }
  if (key.includes('eletric')) {
    return activity || 'Quadros, cabos, equipamentos e instalacoes eletricas';
  }
  if (key.includes('incendio') || key.includes('explos')) {
    return activity || 'Materiais combustiveis, processos a quente ou instalacoes';
  }
  return (
    activity ||
    environment ||
    `Atividades da funcao ${input.jobName?.trim() || ''}`.trim()
  );
}

export function inferOsRiskContext(input: OsRiskContextInput): OsRiskContext {
  const quantitative = compactPgrText(input.extractedQuantitative, 40);
  const source = !isGenericRiskSource(input.extractedSource)
    ? compactPgrText(input.extractedSource, 160) ?? inferFonteFromAgent(input)
    : inferFonteFromAgent(input);
  const exposure = !isGenericRiskSource(input.extractedExposure)
    ? (compactPgrText(input.extractedExposure, 60) ??
      'Habitual e intermitente')
    : 'Habitual e intermitente';
  const evaluation = quantitative
    ? `Qualitativa · ${quantitative}`
    : 'Qualitativa';
  return { source, exposure, evaluation, quantitative };
}

const CATEGORY_ORDER = [
  'FISICO',
  'QUIMICO',
  'BIOLOGICO',
  'ERGONOMICO',
  'MECANICO',
  'ACIDENTE',
  'PSICOSSOCIAL',
  'OUTROS',
];

export function groupOsRisksByCategory<
  T extends { category: string; agent: string },
>(risks: T[]): Array<{ category: string; agents: T[] }> {
  const groups = new Map<string, T[]>();
  for (const risk of risks) {
    const list = groups.get(risk.category) ?? [];
    list.push(risk);
    groups.set(risk.category, list);
  }
  const known = CATEGORY_ORDER.filter((key) => groups.has(key)).map((key) => ({
    category: key,
    agents: groups.get(key)!,
  }));
  const extra = [...groups.keys()]
    .filter((key) => !CATEGORY_ORDER.includes(key))
    .map((key) => ({ category: key, agents: groups.get(key)! }));
  return [...known, ...extra];
}
