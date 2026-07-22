import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './audit/audit.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { ServedClientsModule } from './served-clients/served-clients.module';
import { OperationalUnitsModule } from './operational-units/operational-units.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    PrismaModule,
    AuditModule,
    AuthModule,
    ServedClientsModule,
    OperationalUnitsModule,
    HealthModule,
  ],
})
export class AppModule {}
