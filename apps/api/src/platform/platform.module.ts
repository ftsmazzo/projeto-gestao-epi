import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { CommunicationsModule } from '../communications/communications.module';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';

@Module({
  imports: [AuditModule, CommunicationsModule],
  controllers: [PlatformController],
  providers: [PlatformService],
})
export class PlatformModule {}
