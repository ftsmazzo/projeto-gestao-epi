import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { WorkerStatus } from '@prisma/client';

export class UpdateWorkerDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== '')
  @IsString()
  @MinLength(11)
  @MaxLength(14)
  cpf?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== '')
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  registration?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  role?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  department?: string | null;

  @IsOptional()
  @IsString()
  operationalUnitId?: string | null;

  @IsOptional()
  @IsEnum(WorkerStatus)
  status?: WorkerStatus;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== '')
  @IsDateString()
  admissionDate?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}
