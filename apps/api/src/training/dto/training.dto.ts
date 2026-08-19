import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { TrainingAssetKind, TrainingDeliveryKind } from '@prisma/client';

export class UpsertTrainingTemplateDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(220)
  courseTitle!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  nrLabel?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(80)
  defaultHours?: number;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  defaultLocation?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(2000)
  certificateCourseClause!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  topics?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  registerSummary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  instructorName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  instructorRole?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  instructorRegistry?: string;

  @IsOptional()
  @IsBoolean()
  includeCertificate?: boolean;

  @IsOptional()
  @IsBoolean()
  includeRegister?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class GenerateTrainingDto {
  @IsString()
  servedClientId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  workerIds!: string[];

  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Data deve estar no formato AAAA-MM-DD.',
  })
  heldOn!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(80)
  hours!: number;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  instructorName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  instructorRole?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  instructorRegistry?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  legalRepName?: string;

  @IsOptional()
  @IsEnum(TrainingDeliveryKind)
  deliveryKind?: TrainingDeliveryKind;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  controlNumber?: string;
}

export { TrainingAssetKind, TrainingDeliveryKind };
