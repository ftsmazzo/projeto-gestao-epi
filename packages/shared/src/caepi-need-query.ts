const GENERIC_NEED_TOKENS = new Set([
  'protetor',
  'protecao',
  'seguranca',
  'equipamento',
  'peca',
  'tipo',
  'para',
  'com',
  'real',
]);

function foldNeedName(needName: string): string {
  return needName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Termo que a CAEPI costuma ter no nome oficial — nao o nome operacional inteiro.
 * Frases com 2 palavras sao AND no backend (LUVA DE RASPA casa com "luva raspa").
 */
export function preferredCaepiQuery(needName: string): string {
  const folded = foldNeedName(needName);
  if (folded.includes('viseira')) return 'protetor facial';
  if (folded.includes('plug') || folded.includes('insercao')) return 'plug';
  if (folded.includes('concha') || folded.includes('abafador')) return 'concha';
  if (folded.includes('pff2') || folded.includes('n95')) return 'pff2';
  if (folded.includes('pff1') || folded.includes('contra po')) return 'pff1';
  if (folded.includes('facial inteira') || folded.includes('full face')) {
    return 'facial inteira';
  }
  if (folded.includes('botina') || folded.includes('calcado')) return 'botina';
  if (folded.includes('bota') && folded.includes('borracha')) return 'bota';
  if (folded.includes('capacete')) return 'capacete';
  if (folded.includes('oculos') && folded.includes('ampla')) return 'ampla visao';
  if (folded.includes('oculos')) return 'oculos';
  if (folded.includes('luva') && folded.includes('raspa')) return 'luva raspa';
  if (folded.includes('luva') && folded.includes('vaqueta')) return 'vaqueta';
  if (folded.includes('luva') && folded.includes('pvc')) return 'luva pvc';
  if (folded.includes('luva') && folded.includes('nitril')) return 'nitrilica';
  if (folded.includes('luva') && folded.includes('malha')) return 'luva malha';
  if (folded.includes('luva') && folded.includes('isolante')) return 'luva isolante';
  if (folded.includes('luva') && folded.includes('anticorte')) return 'anticorte';
  if (folded.includes('luva')) return 'luva';
  if (folded.includes('avental') && folded.includes('pvc')) return 'avental pvc';
  if (folded.includes('avental')) return 'avental';
  if (folded.includes('perneira')) return 'perneira';
  if (folded.includes('mascara') && folded.includes('solda')) return 'solda';
  if (folded.includes('cinto') || folded.includes('paraquedista')) {
    return 'paraquedista';
  }
  if (folded.includes('talabarte')) return 'talabarte';
  if (folded.includes('trava')) return 'trava';
  if (folded.includes('creme')) return 'creme';
  const tokens = folded
    .split(/\s+/)
    .map((t) => t.replace(/[^a-z0-9]+/g, ''))
    .filter((t) => t.length >= 4 && !GENERIC_NEED_TOKENS.has(t));
  tokens.sort((a, b) => b.length - a.length);
  return tokens[0] || needName.trim();
}
