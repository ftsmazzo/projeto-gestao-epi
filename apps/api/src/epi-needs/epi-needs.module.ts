import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { EpiNeedsController } from './epi-needs.controller';
import { EpiNeedsService } from './epi-needs.service';

@Module({
  imports: [AuditModule],
  controllers: [EpiNeedsController],
  providers: [EpiNeedsService],
  exports: [EpiNeedsService],
})
export class EpiNeedsModule {}
