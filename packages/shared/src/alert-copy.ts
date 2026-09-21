export type CaAlertKind = 'expired' | 'soon' | 'missing' | 'ok';

export type ReplacementAlertFact = {
  workerName?: string | null;
  epiName: string;
  dueAt: Date | string;
  caNumber?: string | null;
};

export type CaAlertFact = {
  epiName: string;
  caNumber?: string | null;
  expiresAt?: Date | string | null;
  kind: CaAlertKind;
  requiresCa?: boolean;
};

export type DailyAlertCopyInput = {
  recipientName: string;
  clientName: string;
  portalUrl: string;
  replacements: ReplacementAlertFact[];
  caAlerts: CaAlertFact[];
  biometricNames: string[];
  now?: Date;
  limitPerSection?: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function formatAlertDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'data não informada';
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = String(date.getUTCFullYear());
  return `${day}/${month}/${year}`;
}

function asDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function calendarDaysUntil(due: Date, now: Date): number {
  const dueDay = Date.UTC(
    due.getUTCFullYear(),
    due.getUTCMonth(),
    due.getUTCDate(),
  );
  const nowDay = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  return Math.round((dueDay - nowDay) / DAY_MS);
}

function cleanLabel(value: string | null | undefined, fallback: string): string {
  const text = (value ?? '').replace(/\s+/g, ' ').trim();
  return text || fallback;
}

function epiWithCa(epiName: string, caNumber?: string | null): string {
  const epi = cleanLabel(epiName, 'EPI');
  const ca = caNumber?.trim();
  if (!ca) return epi;
  return `${epi} (CA ${ca})`;
}

export function replacementAlertSentence(
  input: ReplacementAlertFact,
  now: Date = new Date(),
): string {
  const epi = epiWithCa(input.epiName, input.caNumber);
  const worker = input.workerName?.trim()
    ? cleanLabel(input.workerName, '')
    : '';
  const owner = worker ? ` do funcionário ${worker}` : '';
  const due = asDate(input.dueAt);
  const when = formatAlertDate(due);
  const days = Number.isNaN(due.getTime()) ? 0 : calendarDaysUntil(due, now);

  if (days < 0) {
    return `O ${epi}${owner} venceu em ${when}. Faça a troca hoje para o trabalhador não permanecer sem proteção válida.`;
  }
  if (days === 0) {
    return `O ${epi}${owner} vence hoje, ${when}. Entregue ainda hoje.`;
  }
  if (days <= 3) {
    return `O ${epi}${owner} vence em ${when}. Entregue com prioridade antes dessa data.`;
  }
  return `O ${epi}${owner} vence em ${when}. Programe a entrega antes dessa data.`;
}

export function caAlertSentence(input: CaAlertFact): string {
  const epi = cleanLabel(input.epiName, 'EPI');
  const ca = input.caNumber?.trim() || '';
  const when = input.expiresAt ? formatAlertDate(input.expiresAt) : null;

  if (input.kind === 'ok' && input.requiresCa === false) {
    return `O EPI ${epi} não exige CA.`;
  }
  if (input.kind === 'missing' || (input.kind !== 'ok' && !ca)) {
    return `O EPI ${epi} exige CA e ainda não tem número cadastrado. Informe o certificado antes de entregar esse item.`;
  }
  if (input.kind === 'expired') {
    return `O CA ${ca} do EPI ${epi} venceu em ${when ?? 'data não informada'}. Suspenda novas entregas desse item e substitua por um CA vigente.`;
  }
  if (input.kind === 'soon') {
    return `O CA ${ca} do EPI ${epi} vence em ${when ?? 'data não informada'}. Renove o certificado ou substitua o item no estoque antes dessa data.`;
  }
  if (!when) {
    return `O EPI ${epi} não tem vencimento de CA informado. Confira se o certificado segue exigido para este item.`;
  }
  return `O CA ${ca || 'sem número'} do EPI ${epi} segue vigente até ${when}.`;
}

export function biometricAlertSentence(workerName: string): string {
  const name = cleanLabel(workerName, 'trabalhador');
  return `O funcionário ${name} está ativo e ainda não tem biometria facial. Envie o convite de cadastro para liberar a entrega com reconhecimento.`;
}

export function stockAlertSentence(
  epiName: string,
  kind: 'zero' | 'low',
): string {
  const epi = cleanLabel(epiName, 'EPI');
  if (kind === 'zero') {
    return `O estoque do EPI ${epi} está zerado. Reponha antes da próxima troca, senão a entrega fica sem material.`;
  }
  return `O estoque do EPI ${epi} está abaixo do mínimo. Programe a reposição para não interromper as trocas.`;
}

export function summarizeAlertLines(lines: string[], limit = 2): string {
  const filled = lines.map((line) => line.trim()).filter(Boolean);
  if (filled.length === 0) return '';
  const shown = filled.slice(0, Math.max(1, limit));
  const rest = filled.length - shown.length;
  const text = shown.join(' ');
  if (rest <= 0) return text;
  const tail =
    rest === 1 ? 'Mais 1 caso está na lista.' : `Mais ${rest} casos estão na lista.`;
  return `${text} ${tail}`;
}

function sortReplacements(
  items: ReplacementAlertFact[],
): ReplacementAlertFact[] {
  const map = new Map<string, ReplacementAlertFact>();
  for (const item of items) {
    const worker = cleanLabel(item.workerName, '').toLocaleLowerCase('pt-BR');
    const epi = cleanLabel(item.epiName, '').toLocaleLowerCase('pt-BR');
    const key = `${worker}|${epi}`;
    const current = map.get(key);
    if (!current) {
      map.set(key, item);
      continue;
    }
    const nextAt = asDate(item.dueAt).getTime();
    const currentAt = asDate(current.dueAt).getTime();
    if (nextAt < currentAt) map.set(key, item);
  }
  return [...map.values()].sort(
    (a, b) => asDate(a.dueAt).getTime() - asDate(b.dueAt).getTime(),
  );
}

function sortCaAlerts(items: CaAlertFact[]): CaAlertFact[] {
  const rank: Record<CaAlertKind, number> = {
    expired: 0,
    soon: 1,
    missing: 2,
    ok: 3,
  };
  return [...items]
    .filter((item) => item.kind !== 'ok')
    .sort((a, b) => {
      const byKind = rank[a.kind] - rank[b.kind];
      if (byKind !== 0) return byKind;
      const aTime = a.expiresAt ? asDate(a.expiresAt).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b.expiresAt ? asDate(b.expiresAt).getTime() : Number.MAX_SAFE_INTEGER;
      if (aTime !== bTime) return aTime - bTime;
      return cleanLabel(a.epiName, '').localeCompare(cleanLabel(b.epiName, ''), 'pt-BR');
    });
}

function clipLines(
  lines: string[],
  limit: number,
  more: (hidden: number) => string,
): string[] {
  if (lines.length <= limit) return lines;
  const hidden = lines.length - limit;
  return [...lines.slice(0, limit), more(hidden)];
}

function joinCount(parts: string[]): string {
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} e ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}`;
}

function countPhrase(total: number, one: string, many: string): string {
  return `${total} ${total === 1 ? one : many}`;
}

export function buildDailyAlertMessage(input: DailyAlertCopyInput): {
  subject: string;
  text: string;
} {
  const now = input.now ?? new Date();
  const limit = input.limitPerSection ?? 8;
  const replacements = sortReplacements(input.replacements);
  const caAlerts = sortCaAlerts(input.caAlerts);
  const biometricNames = [...new Set(input.biometricNames.map((name) => name.trim()).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b, 'pt-BR'),
  );

  const counts = [
    replacements.length > 0
      ? countPhrase(replacements.length, 'troca de EPI', 'trocas de EPI')
      : null,
    caAlerts.length > 0
      ? countPhrase(caAlerts.length, 'validade de CA', 'validades de CA')
      : null,
    biometricNames.length > 0
      ? countPhrase(
          biometricNames.length,
          'biometria pendente',
          'biometrias pendentes',
        )
      : null,
  ].filter((part): part is string => Boolean(part));

  const recipient = cleanLabel(input.recipientName, 'gestor');
  const client = cleanLabel(input.clientName, 'empresa');
  const subject = `Alertas de ${client} em ${formatAlertDate(now)}`;
  if (counts.length === 0) {
    return {
      subject,
      text: [
        `Olá, ${recipient}.`,
        '',
        `A empresa ${client} não tem pendência de troca, CA ou biometria hoje.`,
      ].join('\n'),
    };
  }

  const blocks: string[] = [
    `Olá, ${recipient}.`,
    '',
    `A empresa ${client} tem ${joinCount(counts)}. Comece pelo que já venceu.`,
  ];

  if (replacements.length > 0) {
    const lines = clipLines(
      replacements.map((item) => replacementAlertSentence(item, now)),
      limit,
      (hidden) =>
        hidden === 1
          ? 'Mais 1 troca de EPI está no painel.'
          : `Mais ${hidden} trocas de EPI estão no painel.`,
    );
    blocks.push('', 'Trocas de EPI', '', ...lines.flatMap((line) => [line, '']));
  }

  if (caAlerts.length > 0) {
    const lines = clipLines(
      caAlerts.map((item) => caAlertSentence(item)),
      limit,
      (hidden) =>
        hidden === 1
          ? 'Mais 1 certificado está no painel.'
          : `Mais ${hidden} certificados estão no painel.`,
    );
    blocks.push(
      '',
      'Validade de CA',
      '',
      'EPI com CA vencido ou sem CA não pode ser entregue.',
      '',
      ...lines.flatMap((line) => [line, '']),
    );
  }

  if (biometricNames.length > 0) {
    const lines = clipLines(
      biometricNames.map((name) => biometricAlertSentence(name)),
      limit,
      (hidden) =>
        hidden === 1
          ? 'Mais 1 funcionário sem biometria está no painel.'
          : `Mais ${hidden} funcionários sem biometria estão no painel.`,
    );
    blocks.push(
      '',
      'Biometria facial',
      '',
      'Sem o cadastro, a entrega com reconhecimento facial fica bloqueada.',
      '',
      ...lines.flatMap((line) => [line, '']),
    );
  }

  blocks.push(
    `Painel do cliente: ${input.portalUrl}`,
    '',
    'Trate primeiro o que já venceu. Suporte ProntEPI.',
  );

  return {
    subject,
    text: blocks.join('\n').replace(/\n{3,}/g, '\n\n').trim(),
  };
}
