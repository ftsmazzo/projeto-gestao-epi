import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { TrainingController } from './training.controller';
import { TrainingPdfService } from './training-pdf.service';
import { TrainingService } from './training.service';

@Module({
  imports: [AuditModule],
  controllers: [TrainingController],
  providers: [TrainingService, TrainingPdfService],
})
export class TrainingModule {}
