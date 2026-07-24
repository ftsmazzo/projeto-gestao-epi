import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { WorkerImportService } from './worker-import.service';
import { WorkersController } from './workers.controller';
import { WorkersService } from './workers.service';

@Module({
  imports: [AuditModule],
  controllers: [WorkersController],
  providers: [WorkersService, WorkerImportService],
  exports: [WorkersService],
})
export class WorkersModule {}
