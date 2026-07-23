import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PgroController } from './pgro.controller';
import { PgroService } from './pgro.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [PgroController],
  providers: [PgroService],
})
export class PgroModule {}
