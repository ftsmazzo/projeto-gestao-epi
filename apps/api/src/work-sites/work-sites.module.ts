import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PortalWorkSitesController } from './portal-work-sites.controller';
import { WorkSitesService } from './work-sites.service';

@Module({
  imports: [AuditModule],
  controllers: [PortalWorkSitesController],
  providers: [WorkSitesService],
  exports: [WorkSitesService],
})
export class WorkSitesModule {}
