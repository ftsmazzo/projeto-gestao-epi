import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { CaepiModule } from '../caepi/caepi.module';
import { PgroModule } from '../pgro/pgro.module';
import { StockModule } from '../stock/stock.module';
import { WorkersModule } from '../workers/workers.module';
import { PortalController } from './portal.controller';
import { PortalPdfService } from './portal-pdf.service';
import { PortalReportsService } from './portal-reports.service';
import { PortalService } from './portal.service';

@Module({
  imports: [StockModule, CaepiModule, AuditModule, WorkersModule, PgroModule],
  controllers: [PortalController],
  providers: [PortalService, PortalReportsService, PortalPdfService],
})
export class PortalModule {}
