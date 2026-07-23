import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { EpiImportService } from './epi-import.service';
import { EpisController } from './epis.controller';
import { EpisService } from './epis.service';

@Module({
  imports: [AuditModule],
  controllers: [EpisController],
  providers: [EpisService, EpiImportService],
  exports: [EpisService, EpiImportService],
})
export class EpisModule {}
