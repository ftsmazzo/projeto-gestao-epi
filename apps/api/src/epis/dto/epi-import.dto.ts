import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  EpiCategory,
  EpiUnitOfMeasure,
  EpiUsefulLifeUnit,
} from '@prisma/client';

export class PreviewEpiImportDto {
  @IsString()
  @MinLength(1)
  csvText!: string;
}

export class EpiImportVariantConfirmDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  size?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  color?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  model?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  side?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class EpiImportPayloadConfirmDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @IsBoolean()
  requiresCa!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  caNumber?: string | null;

  @IsOptional()
  @IsString()
  caExpiresAt?: string | null;

  @IsEnum(EpiUnitOfMeasure)
  unitOfMeasure!: EpiUnitOfMeasure;

  @IsOptional()
  @IsInt()
  @Min(0)
  usefulLifeValue?: number | null;

  @IsOptional()
  @IsEnum(EpiUsefulLifeUnit)
  usefulLifeUnit?: EpiUsefulLifeUnit | null;

  @IsOptional()
  @IsEnum(EpiCategory)
  category?: EpiCategory | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  externalCode?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  manufacturerName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  color?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  approvedFor?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  restriction?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  technicalNotes?: string | null;

  @IsOptional()
  @IsNumber()
  nrr?: number | null;

  @IsOptional()
  @IsNumber()
  nrrsf?: number | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => EpiImportVariantConfirmDto)
  variant?: EpiImportVariantConfirmDto | null;
}

export class EpiImportConfirmRowDto {
  @IsInt()
  @Min(1)
  rowNumber!: number;

  @ValidateNested()
  @Type(() => EpiImportPayloadConfirmDto)
  payload!: EpiImportPayloadConfirmDto;
}

export class ConfirmEpiImportDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => EpiImportConfirmRowDto)
  rows!: EpiImportConfirmRowDto[];
}
