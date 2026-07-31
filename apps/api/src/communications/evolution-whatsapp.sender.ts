import { Injectable, Logger } from '@nestjs/common';
import type { SendWhatsappInput, WhatsappSender } from './communication.ports';

type WhatsappNumberCheck = {
  exists?: boolean;
  jid?: string;
  number?: string;
};

export type WhatsappSendReceipt = {
  number: string;
  jid: string | null;
  messageId: string;
  remoteJid: string | null;
};

@Injectable()
export class EvolutionWhatsappSender implements WhatsappSender {
  private readonly logger = new Logger(EvolutionWhatsappSender.name);

  async sendWhatsapp(input: SendWhatsappInput): Promise<void> {
    await this.sendWhatsappWithReceipt(input);
  }

  /** Envia e devolve comprovante (messageId) exigido para marcar SENT. */
  async sendWhatsappWithReceipt(
    input: SendWhatsappInput,
  ): Promise<WhatsappSendReceipt> {
    const baseUrl = process.env.EVOLUTION_API_URL?.trim().replace(/\/$/, '');
    const apiKey = process.env.EVOLUTION_API_KEY?.trim();
    const instance = process.env.EVOLUTION_INSTANCE?.trim();

    if (!baseUrl || !apiKey || !instance) {
      throw new Error(
        'Evolution API nao configurada (EVOLUTION_API_URL / EVOLUTION_API_KEY / EVOLUTION_INSTANCE).',
      );
    }

    const normalized = normalizeWhatsappNumber(input.to);
    if (!normalized) {
      throw new Error(
        `Telefone WhatsApp invalido ("${input.to}"). Use DDD+numero (ex.: 11999999999) ou com 55.`,
      );
    }

    this.logger.log(
      `WhatsApp send start instance=${instance} to=${normalized} url=${baseUrl}`,
    );

    await this.assertInstanceOpen(baseUrl, apiKey, instance);

    const candidates = brazilianNumberCandidates(normalized);
    const resolved = await this.resolveWhatsappNumber(
      baseUrl,
      apiKey,
      instance,
      candidates,
    );
    if (!resolved) {
      throw new Error(
        `Numero sem WhatsApp na Evolution (tentou: ${candidates.join(', ')}). Confira DDD e o 9.`,
      );
    }

    const number = resolved.number;
    const response = await fetch(
      `${baseUrl}/message/sendText/${encodeURIComponent(instance)}`,
      {
        method: 'POST',
        headers: this.authHeaders(apiKey),
        body: JSON.stringify({
          number,
          text: input.text,
          delay: 1200,
          linkPreview: false,
        }),
      },
    );

    const bodyText = await response.text().catch(() => '');
    if (looksLikeHtml(bodyText)) {
      throw new Error(
        `EVOLUTION_API_URL parece apontar para uma pagina HTML, nao para a API (${baseUrl}). Use a URL da API (ex.: https://seu-host:8080).`,
      );
    }

    if (!response.ok) {
      this.logger.warn(
        `Evolution falhou (${response.status}) number=${number}: ${bodyText}`,
      );
      const detail = bodyText.replace(/\s+/g, ' ').trim().slice(0, 180);
      throw new Error(
        `Evolution HTTP ${response.status} (enviado como ${number})${
          detail ? `: ${detail}` : ''
        }`,
      );
    }

    const receipt = extractSendReceipt(bodyText, number, resolved.jid);
    if (!receipt) {
      this.logger.warn(
        `Evolution OK sem messageId number=${number}: ${bodyText.slice(0, 400)}`,
      );
      throw new Error(
        `Evolution respondeu sem messageId (enviado como ${number}). Resposta: ${bodyText
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 200)}`,
      );
    }

    this.logger.log(
      `WhatsApp confirmado instance=${instance} number=${receipt.number} msgId=${receipt.messageId} remoteJid=${receipt.remoteJid ?? 'n/a'}`,
    );
    return receipt;
  }

  private authHeaders(apiKey: string): Record<string, string> {
    return {
      'content-type': 'application/json',
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
    };
  }

  private async assertInstanceOpen(
    baseUrl: string,
    apiKey: string,
    instance: string,
  ) {
    const response = await fetch(
      `${baseUrl}/instance/connectionState/${encodeURIComponent(instance)}`,
      {
        method: 'GET',
        headers: this.authHeaders(apiKey),
      },
    );
    const text = await response.text().catch(() => '');
    if (looksLikeHtml(text)) {
      throw new Error(
        `EVOLUTION_API_URL retornou HTML em connectionState (${baseUrl}). Confira a URL da API.`,
      );
    }
    if (!response.ok) {
      throw new Error(
        `Instancia Evolution "${instance}" inacessivel (HTTP ${response.status}: ${text.slice(0, 120)}).`,
      );
    }
    const state = extractConnectionState(text);
    if (state !== 'open') {
      throw new Error(
        `Instancia Evolution "${instance}" nao esta open (estado=${state ?? 'desconhecido'}). Pareie o QR e tente de novo. Body: ${text
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 120)}`,
      );
    }
  }

  private async resolveWhatsappNumber(
    baseUrl: string,
    apiKey: string,
    instance: string,
    candidates: string[],
  ): Promise<{ number: string; jid: string | null } | null> {
    const skipCheck =
      process.env.EVOLUTION_SKIP_NUMBER_CHECK?.trim().toLowerCase() === 'true';

    const response = await fetch(
      `${baseUrl}/chat/whatsappNumbers/${encodeURIComponent(instance)}`,
      {
        method: 'POST',
        headers: this.authHeaders(apiKey),
        body: JSON.stringify({ numbers: candidates }),
      },
    );
    const text = await response.text().catch(() => '');

    if (!response.ok) {
      if (skipCheck) {
        this.logger.warn(
          `whatsappNumbers falhou; EVOLUTION_SKIP_NUMBER_CHECK=true — usando ${candidates[0]}`,
        );
        return { number: candidates[0]!, jid: null };
      }
      throw new Error(
        `Falha ao validar numero na Evolution (HTTP ${response.status}): ${text
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 160)}`,
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      if (skipCheck) return { number: candidates[0]!, jid: null };
      throw new Error(
        `Resposta invalida de whatsappNumbers: ${text.slice(0, 120)}`,
      );
    }

    if (!Array.isArray(parsed)) {
      if (skipCheck) return { number: candidates[0]!, jid: null };
      throw new Error(
        `whatsappNumbers nao retornou lista: ${text.slice(0, 120)}`,
      );
    }

    const rows = parsed as WhatsappNumberCheck[];
    const hit = rows.find((row) => row && row.exists === true);
    if (!hit) {
      const summary = rows
        .map(
          (r) =>
            `${r.number ?? '?'} exists=${String(r.exists)} jid=${r.jid ?? '-'}`,
        )
        .join('; ');
      this.logger.warn(`Nenhum candidato com WhatsApp: ${summary}`);
      return null;
    }

    const fromJid = hit.jid ? digitsFromJid(hit.jid) : null;
    // Preferir digitos do JID (formato que o Baileys realmente usa)
    const number =
      fromJid ||
      (hit.number ? hit.number.replace(/\D/g, '') : null) ||
      candidates[0]!;
    return { number, jid: hit.jid ?? null };
  }
}

function looksLikeHtml(body: string): boolean {
  const t = body.trim().slice(0, 200).toLowerCase();
  return t.startsWith('<!doctype') || t.startsWith('<html') || t.includes('<head');
}

function extractConnectionState(body: string): string | null {
  try {
    const json = JSON.parse(body) as {
      instance?: { state?: string; instanceName?: string };
      state?: string;
    };
    return json.instance?.state ?? json.state ?? null;
  } catch {
    return null;
  }
}

function extractSendReceipt(
  body: string,
  fallbackNumber: string,
  fallbackJid: string | null,
): WhatsappSendReceipt | null {
  if (!body.trim()) return null;
  try {
    const json = JSON.parse(body) as unknown;
    const key = findMessageKey(json);
    if (!key?.id) return null;
    return {
      number: fallbackNumber,
      jid: fallbackJid,
      messageId: String(key.id),
      remoteJid: key.remoteJid ? String(key.remoteJid) : null,
    };
  } catch {
    return null;
  }
}

function findMessageKey(
  json: unknown,
): { id?: unknown; remoteJid?: unknown } | null {
  if (!json || typeof json !== 'object') return null;
  const obj = json as Record<string, unknown>;

  if (obj.key && typeof obj.key === 'object') {
    return obj.key as { id?: unknown; remoteJid?: unknown };
  }
  if (Array.isArray(json)) {
    for (const item of json) {
      const found = findMessageKey(item);
      if (found?.id) return found;
    }
  }
  // wrappers: { data: {...} } | { response: { key } } | { message: { key } }
  for (const nest of ['data', 'response', 'message', 'result']) {
    if (obj[nest]) {
      const found = findMessageKey(obj[nest]);
      if (found?.id) return found;
    }
  }
  return null;
}

function digitsFromJid(jid: string): string | null {
  const local = jid.split('@')[0]?.trim() ?? '';
  // Ignora LIDs numericos puros sem sentido de telefone curto demais
  const digits = local.replace(/\D/g, '');
  if (local.includes(':')) {
    // formato raro device:jid
    return digits || null;
  }
  if (digits.length >= 10) return digits;
  return null;
}

/**
 * Digitos internacionais sem +.
 * BR local (10/11: DDD+numero) recebe prefixo 55 automaticamente.
 */
export function normalizeWhatsappNumber(raw: string): string | null {
  let digits = raw.replace(/\D/g, '');
  if (!digits) return null;

  if (digits.startsWith('0') && digits.length > 11) {
    digits = digits.replace(/^0+/, '');
  }

  if (digits.startsWith('55') && digits.length >= 12 && digits.length <= 13) {
    return digits;
  }
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  if (digits.length >= 12 && digits.length <= 15) {
    return digits;
  }
  return null;
}

/** Variantes BR com/sem o nono digito (WhatsApp/Evolution oscila entre os dois). */
export function brazilianNumberCandidates(normalized: string): string[] {
  const out = [normalized];
  if (!normalized.startsWith('55')) return out;
  const rest = normalized.slice(2);
  if (rest.length === 11 && rest[2] === '9') {
    out.push(`55${rest.slice(0, 2)}${rest.slice(3)}`);
  } else if (rest.length === 10) {
    out.push(`55${rest.slice(0, 2)}9${rest.slice(2)}`);
  }
  return [...new Set(out)];
}
