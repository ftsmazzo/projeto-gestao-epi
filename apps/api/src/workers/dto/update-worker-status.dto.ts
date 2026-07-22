import { IsEnum } from 'class-validator';
import { WorkerStatus } from '@prisma/client';

export class UpdateWorkerStatusDto {
  @IsEnum(WorkerStatus)
  status!: WorkerStatus;
}
