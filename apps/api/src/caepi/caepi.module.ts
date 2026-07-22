import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { CaepiController } from './caepi.controller';
import { CaepiService } from './caepi.service';

@Module({
  imports: [AuditModule],
  controllers: [CaepiController],
  providers: [CaepiService],
  exports: [CaepiService],
})
export class CaepiModule {}
