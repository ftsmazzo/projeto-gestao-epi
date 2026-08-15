import { normalizeMatchName } from './worker-import.utils';

const STOP_WORDS = new Set([
  'de',
  'da',
  'do',
  'das',
  'dos',
  'e',
  'a',
  'o',
  'as',
  'os',
  'em',
  'na',
  'no',
  'para',
  'com',
]);

/** Abreviações típicas de planilha RH (folha / ERP). */
const ABBREV: Array<[RegExp, string]> = [
  [/\baux\b/g, 'auxiliar'],
  [/\bop\b/g, 'operador'],
  [/\bmaq\b/g, 'maquina'],
  [/\bmaqs\b/g, 'maquinas'],
  [/\bjr\b/g, 'junior'],
  [/\bplen\b/g, 'pleno'],
  [/\bpl\b/g, 'pleno'],
  [/\bsen\b/g, 'senior'],
  [/\bsr\b/g, 'senior'],
  [/\banal\b/g, 'analista'],
  [/\bassist\b/g, 'assistente'],
  [/\blider\b/g, 'lider'],
  [/\bprogr\b/g, 'programador'],
  [/\btec\b/g, 'tecnico'],
  [/\bexec\b/g, 'executivo'],
  [/\bconsult\b/g, 'consultor'],
  [/\bcoord\b/g, 'coordenador'],
  [/\bsuperv\b/g, 'supervisor'],
  [/\bsup\b/g, 'supervisor'],
  [/\bint\b/g, 'interno'],
  [/\bprod\b/g, 'producao'],
  [/\bmont\b/g, 'montagem'],
  [/\bindl\b/g, 'industrial'],
  [/\bind\b/g, 'industrial'],
  [/\bpred\b/g, 'predial'],
  [/\bmanut\b/g, 'manutencao'],
  [/\bprofis\b/g, 'profissional'],
  [/\bprof\b/g, 'profissional'],
  [/\bempilhadeira\b/g, 'empilhadeira'],
  [/\btransp\b/g, 'transporte'],
  [/\blogis\b/g, 'logistica'],
  [/\bfinan[cç]?\b/g, 'financeiro'],
  [/\badm\b/g, 'administrativo'],
  [/\bt\.?\s*i\.?\b/g, 'ti'],
  [/\bplanej\b/g, 'planejamento'],
  [/\barquit\b/g, 'arquitetura'],
  [/\bobras\b/g, 'obras'],
  [/\bvendas\b/g, 'vendas'],
  [/\bcustos\b/g, 'custos'],
];

export function compactMatchKey(value: string): string {
  return normalizeMatchName(value).replace(/[^a-z0-9]+/g, '');
}

export function expandRhAbbreviations(value: string): string {
  let out = normalizeMatchName(value)
    .replace(/[./_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  for (const [re, repl] of ABBREV) {
    out = out.replace(re, repl);
  }
  return out.replace(/\s+/g, ' ').trim();
}

function tokensOf(value: string): string[] {
  return expandRhAbbreviations(value)
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

type Seniority = 'junior' | 'pleno' | 'senior' | null;

function seniorityOf(tokens: string[]): Seniority {
  if (tokens.some((t) => t === 'junior' || t.startsWith('junior'))) return 'junior';
  if (tokens.some((t) => t === 'pleno' || t.startsWith('pleno'))) return 'pleno';
  if (tokens.some((t) => t === 'senior' || t.startsWith('senior'))) return 'senior';
  return null;
}

function tokenCovers(queryToken: string, candidateToken: string): boolean {
  if (queryToken === candidateToken) return true;
  if (candidateToken.startsWith(queryToken) || queryToken.startsWith(candidateToken)) {
    return Math.min(queryToken.length, candidateToken.length) >= 3;
  }
  // tipografia SST: serralheira vs serralheria
  if (
    queryToken.length >= 5 &&
    candidateToken.length >= 5 &&
    (queryToken.includes(candidateToken.slice(0, 5)) ||
      candidateToken.includes(queryToken.slice(0, 5)))
  ) {
    let diff = 0;
    const a = queryToken;
    const b = candidateToken;
    if (Math.abs(a.length - b.length) <= 2) {
      const n = Math.min(a.length, b.length);
      for (let i = 0; i < n; i++) if (a[i] !== b[i]) diff += 1;
      diff += Math.abs(a.length - b.length);
      return diff <= 2;
    }
  }
  return false;
}

/**
 * Score 0..100 de similaridade entre rótulo da planilha RH e nome canônico do PGR.
 * Por padrão, senioridade divergente (JR vs Pleno) zera o match.
 */
export function scoreStructureNameMatch(
  query: string,
  candidate: string,
  options?: { ignoreSeniority?: boolean },
): number {
  const ignoreSeniority = options?.ignoreSeniority === true;
  const qNorm = normalizeMatchName(query);
  const cNorm = normalizeMatchName(candidate);
  if (!qNorm || !cNorm) return 0;
  if (qNorm === cNorm) return 100;

  const qCompact = compactMatchKey(query);
  const cCompact = compactMatchKey(candidate);
  if (qCompact && qCompact === cCompact) return 98;

  const qExp = expandRhAbbreviations(query);
  const cExp = expandRhAbbreviations(candidate);
  if (qExp === cExp) return 96;
  if (compactMatchKey(qExp) === compactMatchKey(cExp)) return 94;

  let qTokens = tokensOf(query);
  let cTokens = tokensOf(candidate);
  if (qTokens.length === 0 || cTokens.length === 0) return 0;

  const qSen = seniorityOf(qTokens);
  const cSen = seniorityOf(cTokens);
  if (!ignoreSeniority && qSen && cSen && qSen !== cSen) return 0;

  // Planilha traz JR/PL e o PGR nao grava nivel → nao exigir o token de senioridade.
  if (qSen && !cSen) {
    qTokens = qTokens.filter(
      (t) => t !== 'junior' && t !== 'pleno' && t !== 'senior',
    );
  }
  if (ignoreSeniority) {
    qTokens = qTokens.filter(
      (t) => t !== 'junior' && t !== 'pleno' && t !== 'senior',
    );
    cTokens = cTokens.filter(
      (t) => t !== 'junior' && t !== 'pleno' && t !== 'senior',
    );
  }
  if (qTokens.length === 0) return 0;

  let covered = 0;
  for (const qt of qTokens) {
    if (cTokens.some((ct) => tokenCovers(qt, ct))) covered += 1;
  }
  const coverRatio = covered / qTokens.length;

  let reverse = 0;
  for (const ct of cTokens) {
    if (qTokens.some((qt) => tokenCovers(ct, qt))) reverse += 1;
  }
  const reverseRatio = cTokens.length ? reverse / cTokens.length : 0;

  // Dominios tipicos RH↔SST antes do corte por cobertura.
  if (
    (qTokens.includes('compras') || qTokens.includes('comprador')) &&
    cTokens.some((t) => t.startsWith('comprador') || t === 'compras')
  ) {
    let score = 82;
    if (!ignoreSeniority && qSen && cSen && qSen === cSen) score += 10;
    if (ignoreSeniority) score = Math.min(score, 78);
    return score;
  }

  if (coverRatio < 0.66) return Math.round(coverRatio * 40);

  let score = coverRatio * 72 + reverseRatio * 18;
  if (!ignoreSeniority && qSen && cSen && qSen === cSen) score += 12;
  if (ignoreSeniority) score = Math.min(score, 78);
  if (cNorm.includes(qNorm) || qNorm.includes(cNorm)) score += 5;

  if (
    qTokens.length >= 2 &&
    cTokens.length === 1 &&
    qTokens.some((t) => tokenCovers(t, cTokens[0]))
  ) {
    score = Math.max(score, 72);
  }

  return Math.min(100, Math.round(score));
}

export type StructureMatchHit<T> = {
  item: T;
  score: number;
};

export function findBestStructureMatch<T>(
  query: string,
  candidates: T[],
  getName: (item: T) => string,
  options?: { minScore?: number; ignoreSeniority?: boolean },
): StructureMatchHit<T> | null {
  const minScore = options?.minScore ?? 70;
  let best: StructureMatchHit<T> | null = null;
  for (const item of candidates) {
    const score = scoreStructureNameMatch(query, getName(item), {
      ignoreSeniority: options?.ignoreSeniority,
    });
    if (score < minScore) continue;
    if (!best || score > best.score) {
      best = { item, score };
    }
  }
  return best;
}

/** Aliases explícitos RH → SST quando o fuzzy sozinho fica no limite. */
const SECTOR_ALIASES: Array<{ from: RegExp; to: RegExp }> = [
  { from: /^a\s*c\s*m$/i, to: /^acm$/i },
  { from: /^p\s*c\s*p$/i, to: /^p\.?c\.?p$/i },
  { from: /administracao\s+de\s+compras|admin\s+compras/i, to: /^compras$/i },
  {
    from: /estoque\s+(de\s+)?produto\s+acabado/i,
    to: /estoque.*(produto\s+acabado)/i,
  },
  { from: /^orcamentos?$/i, to: /^orcamento$/i },
  {
    from: /eng\.?\s*produto|engenharia\s+de\s+produtos|engaria\s+produto/i,
    to: /eng(aria|enharia|\.)?\s*prod|metodos\s+e\s+processos/i,
  },
  {
    from: /^metodos\s+e\s+processos$/i,
    to: /metodos\s+e\s+processos/i,
  },
  {
    from: /^recursos\s+humanos$|^r\.?h\.?$/i,
    to: /departamento\s+pessoal|recursos\s+humanos/i,
  },
  { from: /serralher/i, to: /serralher/i },
  {
    from: /manutencao\s+predial/i,
    to: /^manutencao$|manutencao\s+predial/i,
  },
];

export function findBestSectorMatch<T>(
  query: string,
  candidates: T[],
  getName: (item: T) => string,
): StructureMatchHit<T> | null {
  const qNorm = normalizeMatchName(query);
  const qCompact = compactMatchKey(query);

  // 1) exact / compact
  for (const item of candidates) {
    const name = getName(item);
    if (normalizeMatchName(name) === qNorm) return { item, score: 100 };
    if (compactMatchKey(name) === qCompact && qCompact.length >= 2) {
      return { item, score: 98 };
    }
  }

  // 2) aliases
  for (const alias of SECTOR_ALIASES) {
    if (!alias.from.test(qNorm) && !alias.from.test(qCompact)) continue;
    const hits = candidates.filter((item) => {
      const n = normalizeMatchName(getName(item));
      return alias.to.test(n) || alias.to.test(compactMatchKey(getName(item)));
    });
    if (hits.length === 1) return { item: hits[0], score: 92 };
    if (hits.length > 1) {
      const scored = findBestStructureMatch(query, hits, getName, {
        minScore: 40,
      });
      if (scored) return { ...scored, score: Math.max(scored.score, 88) };
      // Empate de alias: preferir o nome mais parecido por compact/includes.
      let best = hits[0];
      let bestScore = 0;
      for (const item of hits) {
        const n = normalizeMatchName(getName(item));
        let s = 50;
        if (n.includes('desenvolv') && qNorm.includes('desenvolv')) s += 20;
        if (n.includes('produto') && qNorm.includes('produto')) s += 15;
        if (n.includes('metodo') && qNorm.includes('metodo')) s += 20;
        if (compactMatchKey(getName(item)).includes(qCompact.slice(0, 6))) {
          s += 10;
        }
        if (s > bestScore) {
          bestScore = s;
          best = item;
        }
      }
      return { item: best, score: 88 };
    }
  }

  // 3) fuzzy geral
  return findBestStructureMatch(query, candidates, getName, { minScore: 70 });
}

export function findBestJobMatch<T>(
  query: string,
  candidates: T[],
  getName: (item: T) => string,
): StructureMatchHit<T> | null {
  const strict = findBestStructureMatch(query, candidates, getName, {
    minScore: 70,
  });
  if (strict) return strict;
  // Fallback: mesmo cargo no setor com nivel JR/PL/SEN diferente do PGR.
  return findBestStructureMatch(query, candidates, getName, {
    minScore: 74,
    ignoreSeniority: true,
  });
}
