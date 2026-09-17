import { Module } from '@nestjs/common';
import { ActivePlatformAdminGuard } from '../auth/active-platform-admin.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { PlatformSupportController } from './platform-support.controller';
import { PlatformSupportService } from './platform-support.service';
import { PortalSupportController } from './portal-support.controller';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    SupportController,
    PortalSupportController,
    PlatformSupportController,
  ],
  providers: [
    SupportService,
    PlatformSupportService,
    ActivePlatformAdminGuard,
  ],
  exports: [SupportService, PlatformSupportService],
})
export class SupportModule {}
