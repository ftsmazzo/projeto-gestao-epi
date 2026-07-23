import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './audit/audit.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { ServedClientsModule } from './served-clients/served-clients.module';
import { OperationalUnitsModule } from './operational-units/operational-units.module';
import { WorkersModule } from './workers/workers.module';
import { EpisModule } from './epis/epis.module';
import { CaepiModule } from './caepi/caepi.module';
import { StockModule } from './stock/stock.module';
import { EpiNeedsModule } from './epi-needs/epi-needs.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuditModule,
    AuthModule,
    ServedClientsModule,
    OperationalUnitsModule,
    WorkersModule,
    EpisModule,
    CaepiModule,
    StockModule,
    EpiNeedsModule,
    HealthModule,
  ],
})
export class AppModule {}
