import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { WorkersController } from './workers.controller';
import { WorkersService } from './workers.service';

@Module({
  imports: [AuditModule],
  controllers: [WorkersController],
  providers: [WorkersService],
  exports: [WorkersService],
})
export class WorkersModule {}
