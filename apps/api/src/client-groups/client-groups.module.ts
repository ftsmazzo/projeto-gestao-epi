import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ServedClientsModule } from '../served-clients/served-clients.module';
import { ClientGroupsController } from './client-groups.controller';
import { ClientGroupsService } from './client-groups.service';

@Module({
  imports: [AuditModule, ServedClientsModule],
  controllers: [ClientGroupsController],
  providers: [ClientGroupsService],
  exports: [ClientGroupsService],
})
export class ClientGroupsModule {}
