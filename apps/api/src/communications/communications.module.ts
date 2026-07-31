import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CommunicationAlertsService } from './communication-alerts.service';
import { CommunicationsScheduler } from './communications.scheduler';
import { CommunicationsService } from './communications.service';

@Module({
  imports: [PrismaModule],
  providers: [
    CommunicationsService,
    CommunicationAlertsService,
    CommunicationsScheduler,
  ],
  exports: [CommunicationsService, CommunicationAlertsService],
})
export class CommunicationsModule {}
