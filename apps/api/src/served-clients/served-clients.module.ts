import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ServedClientsController } from './served-clients.controller';
import { ServedClientsService } from './served-clients.service';

@Module({
  imports: [AuditModule],
  controllers: [ServedClientsController],
  providers: [ServedClientsService],
  exports: [ServedClientsService],
})
export class ServedClientsModule {}
