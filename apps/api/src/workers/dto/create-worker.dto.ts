import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { WorkerStatus } from '@prisma/client';

export class CreateWorkerDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MinLength(11)
  @MaxLength(14)
  cpf?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  registration?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  role?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  department?: string;

  @IsOptional()
  @IsString()
  operationalUnitId?: string | null;

  @IsOptional()
  @IsEnum(WorkerStatus)
  status?: WorkerStatus;

  @IsOptional()
  @IsDateString()
  admissionDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
