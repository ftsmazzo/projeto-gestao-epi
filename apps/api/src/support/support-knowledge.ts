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

function score(query: string, text: string) {
  const q = normalize(query);
  const t = normalize(text);
  if (!q || !t) return 0;
  if (t.includes(q)) return 10;
  return q
    .split(/\s+/)
    .filter((part) => part.length > 2)
    .reduce((sum, part) => sum + (t.includes(part) ? 2 : 0), 0);
}

function routeMatchScore(path: string | null, entry: SupportKnowledgeEntry) {
  if (!path) return 0;
  const p = normalize(path);
  const candidates = [entry.route, ...(entry.routeAlias ?? [])].filter(Boolean) as string[];
  for (const candidate of candidates) {
    const normalizedCandidate = candidate.replace(/\[[^\]]+\]/g, '[SEG]');
    const escaped = normalizedCandidate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regexSource = escaped.replace(/\[SEG\]/g, '[^/]+');
    const exact = new RegExp(`^${regexSource}$`, 'i');
    const prefix = new RegExp(`^${regexSource}(?:/|$)`, 'i');
    if (exact.test(path)) return 12;
    if (prefix.test(path)) return 9;
    const simplified = normalize(candidate.replace(/\[[^\]]+\]/g, ''));
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

