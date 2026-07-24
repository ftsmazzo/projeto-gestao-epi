import { Module } from '@nestjs/common';
import { CaepiModule } from '../caepi/caepi.module';
import { StockModule } from '../stock/stock.module';
import { PortalController } from './portal.controller';
import { PortalService } from './portal.service';

@Module({
  imports: [StockModule, CaepiModule],
  controllers: [PortalController],
  providers: [PortalService],
})
export class PortalModule {}
