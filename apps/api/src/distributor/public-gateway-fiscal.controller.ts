import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { DistributorService } from './distributor.service';

type GatewayWebhookBody = {
  event?: string;
  id?: string;
  externalId?: string | null;
  status?: string;
  chaveAcesso?: string | null;
  protocolo?: string | null;
  rejectionCode?: string | null;
  rejectionMsg?: string | null;
};

@Controller('public/gateway-fiscal')
export class PublicGatewayFiscalController {
  constructor(private readonly distributor: DistributorService) {}

  @Post('webhook')
  async webhook(
    @Headers('x-gf-webhook-secret') secretHeader: string | undefined,
    @Body() body: GatewayWebhookBody,
  ) {
    const secret = (process.env.GATEWAY_FISCAL_WEBHOOK_SECRET ?? '').trim();
    if (secret) {
      const provided = (secretHeader ?? '').trim();
      const a = Buffer.from(provided);
      const b = Buffer.from(secret);
      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        throw new UnauthorizedException('Webhook secret invalido.');
      }
    }

    if (!body.externalId && !body.id) {
      throw new BadRequestException('Webhook sem id/externalId.');
    }

    return this.distributor.applyGatewayFiscalWebhook(body);
  }
}
