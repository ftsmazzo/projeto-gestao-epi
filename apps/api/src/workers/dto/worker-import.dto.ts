import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { WorkerStatus } from '@prisma/client';

export class PreviewWorkerImportDto {
  /** Texto CSV (UTF-8). Preferir csvBase64 quando o arquivo veio do Excel. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  csvText?: string;

  /** Bytes do arquivo em base64 — o backend detecta UTF-8 vs Windows-1252. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  csvBase64?: string;
}

export class WorkerImportPayloadDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(14)
  cpf?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  registration?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string | null;

  @IsOptional()
  @IsString()
  admissionDate?: string | null;

  @IsEnum(WorkerStatus)
  status!: WorkerStatus;

  @IsOptional()
  @IsString()
  operationalUnitId?: string | null;

  @IsOptional()
  @IsString()
  clientSectorId?: string | null;

  @IsOptional()
  @IsString()
  clientJobFunctionId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  department?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  role?: string | null;
}

export class WorkerImportConfirmRowDto {
  @IsInt()
  @Min(1)
  rowNumber!: number;

  @ValidateNested()
  @Type(() => WorkerImportPayloadDto)
  payload!: WorkerImportPayloadDto;
}

export class ConfirmWorkerImportDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkerImportConfirmRowDto)
  rows!: WorkerImportConfirmRowDto[];
}
