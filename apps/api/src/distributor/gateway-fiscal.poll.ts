import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { DistributorService } from './distributor.service';
import { GatewayFiscalClient } from './gateway-fiscal.client';

/** Backup se o webhook falhar: consulta status no gateway. */
@Injectable()
export class GatewayFiscalPollJob {
  private readonly logger = new Logger(GatewayFiscalPollJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: GatewayFiscalClient,
    private readonly distributor: DistributorService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async pollPending() {
    if (!this.gateway.isConfigured()) return;

    const pending = await this.prisma.distributorOutboundInvoice.findMany({
      where: {
        status: 'CONFIRMED',
        gatewayDocumentId: { not: null },
      },
      take: 30,
      orderBy: { updatedAt: 'asc' },
    });

    for (const invoice of pending) {
      if (!invoice.gatewayDocumentId) continue;
      try {
        const status = await this.gateway.getNfeStatus(invoice.gatewayDocumentId);
        await this.distributor.applyGatewayFiscalWebhook({
          event:
            status.status === 'autorizada'
              ? 'nfe.autorizada'
              : status.status === 'rejeitada'
                ? 'nfe.rejeitada'
                : undefined,
          id: status.id,
          externalId: invoice.id,
          status: status.status,
          chaveAcesso: status.chaveAcesso,
          protocolo: status.protocolo,
          rejectionCode: status.rejectionCode,
          rejectionMsg: status.rejectionMsg,
        });
      } catch (err) {
        this.logger.warn(
          `Poll gateway falhou invoice=${invoice.id}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
  }
}
