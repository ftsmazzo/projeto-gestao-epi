import { Injectable, Logger } from '@nestjs/common';
import type { EmailSender, SendEmailInput } from './communication.ports';

@Injectable()
export class BrevoEmailSender implements EmailSender {
  private readonly logger = new Logger(BrevoEmailSender.name);

  async sendEmail(input: SendEmailInput): Promise<void> {
    const apiKey = process.env.BREVO_API_KEY?.trim();
    const senderEmail = process.env.BREVO_SENDER_EMAIL?.trim();
    const senderName =
      process.env.BREVO_SENDER_NAME?.trim() || 'Gestao EPI';

    if (!apiKey || !senderEmail) {
      throw new Error(
        'Brevo nao configurado (BREVO_API_KEY / BREVO_SENDER_EMAIL).',
      );
    }

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        sender: { email: senderEmail, name: senderName },
        to: [{ email: input.to }],
        subject: input.subject,
        textContent: input.text,
        ...(input.html ? { htmlContent: input.html } : {}),
        ...(input.replyTo
          ? { replyTo: { email: input.replyTo } }
          : {}),
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      this.logger.warn(`Brevo falhou (${response.status}): ${body}`);
      throw new Error(`Brevo HTTP ${response.status}`);
    }
  }
}
