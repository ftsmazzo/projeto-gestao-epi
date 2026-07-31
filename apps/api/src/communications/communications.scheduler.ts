import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CommunicationAlertsService } from './communication-alerts.service';
import { CommunicationsService } from './communications.service';

@Injectable()
export class CommunicationsScheduler {
  private readonly logger = new Logger(CommunicationsScheduler.name);

  constructor(
    private readonly communications: CommunicationsService,
    private readonly alerts: CommunicationAlertsService,
  ) {}

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

  /** 11:00 UTC (~08:00 BRT). Desative com COMMUNICATIONS_ALERTS_ENABLED=false. */
  @Cron('0 11 * * *')
  async dailyClientAlerts() {
    if (!this.communications.isEnabled()) return;
    if (process.env.COMMUNICATIONS_ALERTS_ENABLED?.trim().toLowerCase() === 'false') {
      return;
    }
    try {
      await this.alerts.runDailyClientAlerts();
    } catch (err) {
      this.logger.warn(
        `Falha nos alertas diarios: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
