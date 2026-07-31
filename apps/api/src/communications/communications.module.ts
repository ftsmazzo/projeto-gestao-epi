import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CommunicationsScheduler } from './communications.scheduler';
import { CommunicationsService } from './communications.service';

@Module({
  imports: [PrismaModule],
  providers: [CommunicationsService, CommunicationsScheduler],
  exports: [CommunicationsService],
})
export class CommunicationsModule {}
