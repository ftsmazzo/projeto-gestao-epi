import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CommunicationsService } from './communications.service';

@Injectable()
export class CommunicationsScheduler {
  private readonly logger = new Logger(CommunicationsScheduler.name);

  constructor(private readonly communications: CommunicationsService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async retryPending() {
    if (!this.communications.isEnabled()) return;
    try {
      const result = await this.communications.processPending(30);
      if (result.processed > 0) {
        this.logger.log(
          `Outbox: ${result.processed} mensagem(ns) processada(s).`,
        );
      }
    } catch (err) {
      this.logger.warn(
        `Falha no retry do outbox: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
