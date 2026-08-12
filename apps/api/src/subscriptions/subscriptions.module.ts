import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ServedClientsModule } from '../served-clients/served-clients.module';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

@Module({
  imports: [AuditModule, ServedClientsModule],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService],
})
export class SubscriptionsModule {}
