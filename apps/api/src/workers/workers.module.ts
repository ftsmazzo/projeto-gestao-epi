import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { CommunicationsModule } from '../communications/communications.module';
import { PgroModule } from '../pgro/pgro.module';
import { BiometricRetentionSchedulerService } from './biometric-retention.scheduler';
import { BiometricRetentionService } from './biometric-retention.service';
import { PublicFacialEnrollmentController } from './public-facial-enrollment.controller';
import { WorkerBiometricConsentService } from './worker-biometric-consent.service';
import { WorkerFacialEnrollmentService } from './worker-facial-enrollment.service';
import { WorkerFacialReferenceService } from './worker-facial-reference.service';
import { WorkerImportService } from './worker-import.service';
import { WorkersController } from './workers.controller';
import { WorkersService } from './workers.service';

@Module({
  imports: [AuditModule, CommunicationsModule, PgroModule],
  controllers: [WorkersController, PublicFacialEnrollmentController],
  providers: [
    WorkersService,
    WorkerImportService,
    WorkerFacialReferenceService,
    WorkerBiometricConsentService,
    WorkerFacialEnrollmentService,
    BiometricRetentionService,
    BiometricRetentionSchedulerService,
  ],
  exports: [
    WorkersService,
    WorkerImportService,
    WorkerFacialReferenceService,
    WorkerBiometricConsentService,
    BiometricRetentionService,
    WorkerFacialEnrollmentService,
  ],
})
export class WorkersModule {}
