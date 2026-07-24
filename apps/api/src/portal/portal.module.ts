import { Module } from '@nestjs/common';
import { StockModule } from '../stock/stock.module';
import { PortalController } from './portal.controller';
import { PortalService } from './portal.service';

@Module({
  imports: [StockModule],
  controllers: [PortalController],
  providers: [PortalService],
})
export class PortalModule {}
