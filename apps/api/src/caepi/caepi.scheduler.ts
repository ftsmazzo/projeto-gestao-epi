import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { readCaepiRuntimeConfig } from './caepi-config';
import { CaepiSyncService } from './caepi-sync.service';

@Injectable()
export class CaepiSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(CaepiSchedulerService.name);

  constructor(
    private readonly sync: CaepiSyncService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  onModuleInit() {
    const config = readCaepiRuntimeConfig();
    if (!config.autoSyncEnabled) {
      this.logger.log(
        'Rotina CAEPI desabilitada (CAEPI_AUTO_SYNC_ENABLED!=true).',
      );
      return;
    }

    const job = new CronJob(config.syncCron, () => {
      void this.handleCron();
    });
    this.schedulerRegistry.addCronJob('caepi-auto-sync', job);
    job.start();
    this.logger.log(
      `Rotina CAEPI agendada com cron "${config.syncCron}" (SCHEDULED).`,
    );
  }

  private async handleCron() {
    this.logger.log('Iniciando sync CAEPI agendado...');
    try {
      const result = await this.sync.startScheduledSync();
      if (result) {
        this.logger.log(`Sync agendado enfileirado: runId=${result.runId}`);
      }
    } catch (error) {
      this.logger.error(
        error instanceof Error
          ? error.message
          : 'Falha ao enfileirar sync CAEPI agendado.',
      );
    }
  }
}
