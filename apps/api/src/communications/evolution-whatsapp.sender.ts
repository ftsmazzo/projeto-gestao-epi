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
      throw new Error('Telefone WhatsApp invalido.');
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
      this.logger.warn(`Evolution falhou (${response.status}): ${body}`);
      throw new Error(`Evolution HTTP ${response.status}`);
    }
  }
}

/** Mantem apenas digitos; assume BR se vier com 10/11 digitos locais. */
export function normalizeWhatsappNumber(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if (digits.length >= 12) return digits;
  return null;
}
