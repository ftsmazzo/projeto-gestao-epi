import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PortalSupportController } from './portal-support.controller';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';

@Module({
  imports: [PrismaModule],
  controllers: [SupportController, PortalSupportController],
  providers: [SupportService],
  exports: [SupportService],
})
export class SupportModule {}
