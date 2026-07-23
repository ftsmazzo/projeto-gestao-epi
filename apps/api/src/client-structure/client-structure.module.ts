import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ClientStructureController } from './client-structure.controller';
import { ClientStructureService } from './client-structure.service';

@Module({
  imports: [AuditModule],
  controllers: [ClientStructureController],
  providers: [ClientStructureService],
  exports: [ClientStructureService],
})
export class ClientStructureModule {}
