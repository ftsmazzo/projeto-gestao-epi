import { Logger } from '@nestjs/common';

export type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string | null;
};

export type SendWhatsappInput = {
  to: string;
  text: string;
};

export interface EmailSender {
  sendEmail(input: SendEmailInput): Promise<void>;
}

export interface WhatsappSender {
  sendWhatsapp(input: SendWhatsappInput): Promise<void>;
}

export class NoopEmailSender implements EmailSender {
  private readonly logger = new Logger(NoopEmailSender.name);

  async sendEmail(input: SendEmailInput): Promise<void> {
    this.logger.debug(`Noop e-mail para ${input.to}: ${input.subject}`);
  }
}

export class NoopWhatsappSender implements WhatsappSender {
  private readonly logger = new Logger(NoopWhatsappSender.name);

  async sendWhatsapp(input: SendWhatsappInput): Promise<void> {
    this.logger.debug(`Noop WhatsApp para ${input.to}`);
  }
}
