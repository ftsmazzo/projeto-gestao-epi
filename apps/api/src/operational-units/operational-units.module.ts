import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { OperationalUnitsController } from './operational-units.controller';
import { OperationalUnitsService } from './operational-units.service';

@Module({
  imports: [AuditModule],
  controllers: [OperationalUnitsController],
  providers: [OperationalUnitsService],
  exports: [OperationalUnitsService],
})
export class OperationalUnitsModule {}
