import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { CaepiModule } from '../caepi/caepi.module';
import { StockModule } from '../stock/stock.module';
import { PortalController } from './portal.controller';
import { PortalReportsService } from './portal-reports.service';
import { PortalService } from './portal.service';

@Module({
  imports: [StockModule, CaepiModule, AuditModule],
  controllers: [PortalController],
  providers: [PortalService, PortalReportsService],
})
export class PortalModule {}
