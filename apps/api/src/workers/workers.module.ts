import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { BiometricRetentionSchedulerService } from './biometric-retention.scheduler';
import { BiometricRetentionService } from './biometric-retention.service';
import { WorkerBiometricConsentService } from './worker-biometric-consent.service';
import { WorkerFacialReferenceService } from './worker-facial-reference.service';
import { WorkerImportService } from './worker-import.service';
import { WorkersController } from './workers.controller';
import { WorkersService } from './workers.service';

@Module({
  imports: [AuditModule],
  controllers: [WorkersController],
  providers: [
    WorkersService,
    WorkerImportService,
    WorkerFacialReferenceService,
    WorkerBiometricConsentService,
    BiometricRetentionService,
    BiometricRetentionSchedulerService,
  ],
  exports: [
    WorkersService,
    WorkerFacialReferenceService,
    WorkerBiometricConsentService,
    BiometricRetentionService,
  ],
})
export class WorkersModule {}
