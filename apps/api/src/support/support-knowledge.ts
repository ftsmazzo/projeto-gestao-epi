import {
  SUPPORT_KB_V2_ENTRIES,
  SUPPORT_KB_VERSION,
  type SupportKnowledgeEntryRecord,
  type SupportScopeKind,
} from './kb/support-kb.v2';

export type { SupportScopeKind };
export type SupportKnowledgeEntry = SupportKnowledgeEntryRecord;

export const SUPPORT_KNOWLEDGE_VERSION = SUPPORT_KB_VERSION;
export const SUPPORT_KNOWLEDGE: SupportKnowledgeEntry[] = SUPPORT_KB_V2_ENTRIES;

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function editDistance(a: string, b: string) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix: number[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => 0),
  );
  for (let i = 0; i < rows; i += 1) matrix[i][0] = i;
  for (let j = 0; j < cols; j += 1) matrix[0][j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  return matrix[a.length][b.length];
}

function score(query: string, text: string) {
  const q = normalize(query);
  const t = normalize(text);
  if (!q || !t) return 0;
  if (t.includes(q)) return 10;
  const lexical = q
    .split(/\s+/)
    .filter((part) => part.length > 2)
    .reduce((sum, part) => sum + (t.includes(part) ? 2 : 0), 0);
  const qTokens = q.split(/\s+/).filter((part) => part.length > 3);
  const tTokens = t.split(/\s+/).filter((part) => part.length > 3);
  let fuzzy = 0;
  for (const qt of qTokens) {
    for (const tt of tTokens) {
      const distance = editDistance(qt, tt);
      if (distance === 0) {
        fuzzy += 2;
        break;
      }
      if (distance === 1 || (qt.length >= 7 && distance === 2)) {
        fuzzy += 1;
        break;
      }
    }
  }
  return lexical + fuzzy;
}

function routeMatchScore(path: string | null, entry: SupportKnowledgeEntry) {
  if (!path) return 0;
  const pathOnly = path.split('?')[0] || path;
  const p = normalize(pathOnly);
  const candidates = [entry.route, ...(entry.routeAlias ?? [])].filter(Boolean) as string[];
  for (const candidate of candidates) {
    const candidatePath = candidate.split('?')[0] || candidate;
    const normalizedCandidate = candidatePath.replace(/\[[^\]]+\]/g, '[SEG]');
    const escaped = normalizedCandidate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regexSource = escaped.replace(/\[SEG\]/g, '[^/]+');
    const exact = new RegExp(`^${regexSource}$`, 'i');
    const prefix = new RegExp(`^${regexSource}(?:/|$)`, 'i');
    if (exact.test(pathOnly)) return 12;
    if (prefix.test(pathOnly)) return 9;
    const simplified = normalize(candidatePath.replace(/\[[^\]]+\]/g, ''));
    if (simplified && p.includes(simplified.replace(/\/{2,}/g, '/'))) return 6;
  }
  return 0;
}

export function searchSupportKnowledge(input: {
  query: string;
  scope: SupportScopeKind;
  currentPath?: string | null;
  limit?: number;
}): SupportKnowledgeEntry[] {
  const { query, scope, currentPath = null, limit = 4 } = input;
  return SUPPORT_KNOWLEDGE
    .filter((entry) => entry.scope === 'BOTH' || entry.scope === scope)
    .map((entry) => ({
      entry,
      score:
        score(query, entry.title) * 2 +
        score(query, entry.question) * 3 +
        score(query, entry.answer) * 2 +
        (entry.steps ?? []).reduce((sum, step) => sum + score(query, step), 0) +
        (entry.warnings ?? []).reduce((sum, warning) => sum + score(query, warning), 0) +
        entry.tags.reduce((sum, tag) => sum + score(query, tag) * 2, 0) +
        routeMatchScore(currentPath, entry) +
        (entry.scope === scope ? 8 : entry.scope === 'BOTH' ? 4 : 1),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.entry);
}

