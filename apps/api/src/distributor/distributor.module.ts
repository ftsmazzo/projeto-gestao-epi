import { Module } from '@nestjs/common';
import { StockModule } from '../stock/stock.module';
import { DistributorController } from './distributor.controller';
import { DistributorService } from './distributor.service';
import { GatewayFiscalClient } from './gateway-fiscal.client';
import { GatewayFiscalPollJob } from './gateway-fiscal.poll';
import { PublicGatewayFiscalController } from './public-gateway-fiscal.controller';

@Module({
  imports: [StockModule],
  controllers: [DistributorController, PublicGatewayFiscalController],
  providers: [DistributorService, GatewayFiscalClient, GatewayFiscalPollJob],
})
export class DistributorModule {}
