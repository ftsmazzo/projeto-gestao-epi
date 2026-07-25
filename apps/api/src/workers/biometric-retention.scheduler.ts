import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { BiometricRetentionService } from './biometric-retention.service';

function readRetentionEnabled(): boolean {
  return process.env.BIOMETRIC_RETENTION_ENABLED?.trim().toLowerCase() === 'true';
}

function readRetentionCron(): string {
  return process.env.BIOMETRIC_RETENTION_CRON?.trim() || '0 2 * * *';
}

@Injectable()
export class BiometricRetentionSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(BiometricRetentionSchedulerService.name);

  constructor(
    private readonly retention: BiometricRetentionService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  onModuleInit() {
    if (!readRetentionEnabled()) {
      this.logger.log(
        'Rotina de retencao biometrica desabilitada (BIOMETRIC_RETENTION_ENABLED!=true).',
      );
      return;
    }

    const cron = readRetentionCron();
    const job = new CronJob(cron, () => {
      void this.handleCron();
    });
    this.schedulerRegistry.addCronJob('biometric-retention', job);
    job.start();
    this.logger.log(
      `Rotina de retencao biometrica agendada com cron "${cron}".`,
    );
  }

  private async handleCron() {
    this.logger.log('Iniciando retencao biometrica agendada...');
    try {
      const result = await this.retention.run({
        triggeredBy: 'SCHEDULED',
        organizationId: null,
        userId: null,
      });
      this.logger.log(
        `Retencao concluida: refs=${result.referencesDeleted} evid=${result.evidencesDeleted} falhas=${result.referencesFailed + result.evidencesFailed}`,
      );
    } catch (error) {
      this.logger.error(
        error instanceof Error
          ? error.message
          : 'Falha na retencao biometrica agendada.',
      );
    }
  }
}
