import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
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

export class EpiVariantInputDto {
  @IsOptional()
  @IsString()
  id?: string;

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

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateEpiItemDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsBoolean()
  requiresCa?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  caNumber?: string;

  @IsOptional()
  @IsDateString()
  caExpiresAt?: string;

  @IsOptional()
  @IsEnum(EpiUnitOfMeasure)
  unitOfMeasure?: EpiUnitOfMeasure;

  @IsOptional()
  @IsInt()
  @Min(0)
  usefulLifeValue?: number;

  @IsOptional()
  @IsEnum(EpiUsefulLifeUnit)
  usefulLifeUnit?: EpiUsefulLifeUnit;

  @IsOptional()
  @IsEnum(EpiCategory)
  category?: EpiCategory;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  externalCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  manufacturerName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  color?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  approvedFor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  restriction?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  technicalNotes?: string;

  @IsOptional()
  @IsNumber()
  nrr?: number;

  @IsOptional()
  @IsNumber()
  nrrsf?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EpiVariantInputDto)
  variants?: EpiVariantInputDto[];
}
