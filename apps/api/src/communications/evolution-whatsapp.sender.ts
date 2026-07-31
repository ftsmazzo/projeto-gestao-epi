import { Injectable, Logger } from '@nestjs/common';
import type { SendWhatsappInput, WhatsappSender } from './communication.ports';

type WhatsappNumberCheck = {
  exists?: boolean;
  jid?: string;
  number?: string;
};

@Injectable()
export class EvolutionWhatsappSender implements WhatsappSender {
  private readonly logger = new Logger(EvolutionWhatsappSender.name);

  async sendWhatsapp(input: SendWhatsappInput): Promise<void> {
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
        headers: {
          'content-type': 'application/json',
          apikey: apiKey,
        },
        body: JSON.stringify({
          number,
          text: input.text,
          delay: 1200,
        }),
      },
    );

    const bodyText = await response.text().catch(() => '');
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

    if (!looksLikeAcceptedSend(bodyText)) {
      this.logger.warn(
        `Evolution respondeu OK sem comprovante de envio number=${number}: ${bodyText.slice(0, 300)}`,
      );
      throw new Error(
        `Evolution aceitou a chamada mas nao confirmou o envio (${number}). Resposta: ${bodyText
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 160)}`,
      );
    }

    this.logger.log(
      `WhatsApp aceito pela Evolution number=${number} jid=${resolved.jid ?? 'n/a'}`,
    );
  }

  private async assertInstanceOpen(
    baseUrl: string,
    apiKey: string,
    instance: string,
  ) {
    try {
      const response = await fetch(
        `${baseUrl}/instance/connectionState/${encodeURIComponent(instance)}`,
        {
          method: 'GET',
          headers: { apikey: apiKey },
        },
      );
      const text = await response.text().catch(() => '');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${text.slice(0, 120)}`);
      }
      const state = extractConnectionState(text);
      if (state && state !== 'open') {
        throw new Error(`estado=${state}`);
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Instancia Evolution "${instance}" nao esta conectada (${detail}). Pareie o QR e tente de novo.`,
      );
    }
  }

  private async resolveWhatsappNumber(
    baseUrl: string,
    apiKey: string,
    instance: string,
    candidates: string[],
  ): Promise<{ number: string; jid: string | null } | null> {
    try {
      const response = await fetch(
        `${baseUrl}/chat/whatsappNumbers/${encodeURIComponent(instance)}`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            apikey: apiKey,
          },
          body: JSON.stringify({ numbers: candidates }),
        },
      );
      const text = await response.text().catch(() => '');
      if (!response.ok) {
        this.logger.warn(
          `whatsappNumbers falhou (${response.status}): ${text.slice(0, 200)}`,
        );
        // Fallback: envia o candidato principal se a checagem nao estiver disponivel
        return { number: candidates[0]!, jid: null };
      }

      const parsed = JSON.parse(text) as WhatsappNumberCheck[] | unknown;
      if (!Array.isArray(parsed)) {
        return { number: candidates[0]!, jid: null };
      }

      const hit = parsed.find((row) => row && row.exists === true);
      if (!hit) return null;

      const fromJid = hit.jid ? digitsFromJid(hit.jid) : null;
      const number =
        (hit.number ? hit.number.replace(/\D/g, '') : null) ||
        fromJid ||
        candidates[0]!;
      return { number, jid: hit.jid ?? null };
    } catch (err) {
      this.logger.warn(
        `whatsappNumbers indisponivel: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return { number: candidates[0]!, jid: null };
    }
  }
}

function extractConnectionState(body: string): string | null {
  try {
    const json = JSON.parse(body) as {
      instance?: { state?: string };
      state?: string;
    };
    return json.instance?.state ?? json.state ?? null;
  } catch {
    return null;
  }
}

function looksLikeAcceptedSend(body: string): boolean {
  if (!body.trim()) return true; // algumas builds retornam vazio
  try {
    const json = JSON.parse(body) as Record<string, unknown>;
    if (json.error || json.status === 400 || json.status === 'ERROR') {
      return false;
    }
    // Formatos comuns Evolution/Baileys
    if (json.key && typeof json.key === 'object') return true;
    if (Array.isArray(json) && json[0] && typeof json[0] === 'object') {
      const first = json[0] as { key?: unknown };
      if (first.key) return true;
    }
    if (typeof json.messageId === 'string' || typeof json.id === 'string') {
      return true;
    }
    // Se veio JSON sem sinal claro de erro, aceita (compat)
    return true;
  } catch {
    return !/error|fail|invalid/i.test(body);
  }
}

function digitsFromJid(jid: string): string | null {
  const local = jid.split('@')[0]?.trim() ?? '';
  const digits = local.replace(/\D/g, '');
  return digits || null;
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
