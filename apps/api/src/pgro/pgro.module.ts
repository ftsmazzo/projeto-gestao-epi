import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ServedClientsModule } from '../served-clients/served-clients.module';
import { PgroController } from './pgro.controller';
import { PgroService } from './pgro.service';

@Module({
  imports: [PrismaModule, AuditModule, ServedClientsModule],
  controllers: [PgroController],
  providers: [PgroService],
})
export class PgroModule {}
