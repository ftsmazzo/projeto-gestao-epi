function normalizeKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Necessidades de EPI sugeridas a partir do risco.
 * Nomes batem com DEFAULT_EPI_NEED_SEEDS. Lista vazia = risco sem EPI tipico.
 */
export const RISK_EPI_NEED_SUGGESTIONS: Record<string, string[]> = {
  ruido: ['Protetor Auricular Plug', 'Protetor Auricular Concha'],
  calor: ['Avental de Raspa', 'Luva de Raspa', 'Luva de Vaqueta'],
  frio: ['Capa de Chuva', 'Luva de Vaqueta'],
  umidade: ['Bota de Borracha', 'Capa de Chuva'],
  poeira: ['Respirador PFF1', 'Respirador PFF2'],
  'produto quimico': [
    'Luva Nitrilica',
    'Luva de PVC',
    'Avental de PVC',
    'Oculos de Ampla Visao',
    'Creme Protetor',
  ],
  'radiacao nao ionizante': ['Oculos de Seguranca', 'Mascara de Solda'],
  'agentes biologicos': [
    'Respirador PFF2',
    'Luva Nitrilica',
    'Oculos de Seguranca',
  ],
  'levantamento e transporte manual de peso': [
    'Cinta Lombar',
    'Botina de Seguranca',
  ],
  'corte perfuracao': [
    'Luva Anticorte',
    'Luva de Vaqueta',
    'Luva Nitrilica',
  ],
  'queda de altura': ['Cinto de Seguranca', 'Talabarte', 'Trava-quedas'],
  'queda de objetos': ['Capacete de Seguranca'],
  'queda no mesmo nivel': ['Botina de Seguranca'],
  'colisao atropelamento': [
    'Capacete de Seguranca',
    'Botina de Seguranca',
    'Viseira Facial',
  ],
  eletricidade: ['Luva Isolante', 'Botina de Seguranca'],
  'maquinas e equipamentos': [
    'Luva Anticorte',
    'Oculos de Seguranca',
    'Botina de Seguranca',
  ],
  'incendio explosao': ['Avental Trevira', 'Oculos de Seguranca'],
  'impacto nos olhos': ['Oculos de Seguranca', 'Viseira Facial'],
};

export function suggestedNeedNamesForRisk(riskName: string): string[] {
  const key = normalizeKey(riskName);
  if (RISK_EPI_NEED_SUGGESTIONS[key]) {
    return RISK_EPI_NEED_SUGGESTIONS[key];
  }
  let best: { names: string[]; len: number } | null = null;
  for (const [pattern, names] of Object.entries(RISK_EPI_NEED_SUGGESTIONS)) {
    if (names.length === 0) continue;
    if (key.includes(pattern) || pattern.includes(key)) {
      if (!best || pattern.length > best.len) {
        best = { names, len: pattern.length };
      }
    }
  }
  return best?.names ?? [];
}

export function normalizeRiskNeedKey(name: string): string {
  return normalizeKey(name);
}
