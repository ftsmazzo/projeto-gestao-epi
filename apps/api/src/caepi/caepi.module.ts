import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { CaepiDownloadService } from './caepi-download.service';
import { CaepiSyncService } from './caepi-sync.service';
import { CaepiController } from './caepi.controller';
import { CaepiSchedulerService } from './caepi.scheduler';
import { CaepiService } from './caepi.service';

@Module({
  imports: [AuditModule],
  controllers: [CaepiController],
  providers: [
    CaepiService,
    CaepiDownloadService,
    CaepiSyncService,
    CaepiSchedulerService,
  ],
  exports: [CaepiService, CaepiSyncService],
})
export class CaepiModule {}
