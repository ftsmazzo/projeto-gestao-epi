import { Injectable, Logger } from '@nestjs/common';
import type { SendWhatsappInput, WhatsappSender } from './communication.ports';

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

    const number = normalizeWhatsappNumber(input.to);
    if (!number) {
      throw new Error(
        `Telefone WhatsApp invalido ("${input.to}"). Use DDD+numero (ex.: 11999999999) ou com 55.`,
      );
    }

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
        }),
      },
    );

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      this.logger.warn(
        `Evolution falhou (${response.status}) number=${number}: ${body}`,
      );
      const detail = body.replace(/\s+/g, ' ').trim().slice(0, 180);
      throw new Error(
        `Evolution HTTP ${response.status} (enviado como ${number})${
          detail ? `: ${detail}` : ''
        }`,
      );
    }
  }
}

/**
 * Digitos internacionais sem +.
 * BR local (10/11: DDD+numero) recebe prefixo 55 automaticamente.
 */
export function normalizeWhatsappNumber(raw: string): string | null {
  let digits = raw.replace(/\D/g, '');
  if (!digits) return null;

  // Remove zero a esquerda tipo 05511...
  if (digits.startsWith('0') && digits.length > 11) {
    digits = digits.replace(/^0+/, '');
  }

  if (digits.startsWith('55') && digits.length >= 12 && digits.length <= 13) {
    return digits;
  }
  // Celular/fixo BR: DDD (2) + numero (8 ou 9)
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  // Outros paises / ja internacional
  if (digits.length >= 12 && digits.length <= 15) {
    return digits;
  }
  return null;
}
