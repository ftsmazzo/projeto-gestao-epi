import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { EpisController } from './epis.controller';
import { EpisService } from './epis.service';

@Module({
  imports: [AuditModule],
  controllers: [EpisController],
  providers: [EpisService],
  exports: [EpisService],
})
export class EpisModule {}
