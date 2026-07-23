import { Transform, Type } from 'class-transformer';
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

/** Trunca strings longas (ex.: CAEPI) antes do MaxLength. */
function Truncate(max: number) {
  return Transform(({ value }: { value: unknown }) => {
    if (value == null || typeof value !== 'string') return value;
    const trimmed = value.trim();
    if (!trimmed) return value;
    return trimmed.length > max ? trimmed.slice(0, max).trimEnd() : trimmed;
  });
}

export class EpiVariantInputDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @Truncate(80)
  @IsString()
  @MaxLength(80)
  size?: string | null;

  @IsOptional()
  @Truncate(80)
  @IsString()
  @MaxLength(80)
  color?: string | null;

  @IsOptional()
  @Truncate(120)
  @IsString()
  @MaxLength(120)
  model?: string | null;

  @IsOptional()
  @Truncate(40)
  @IsString()
  @MaxLength(40)
  side?: string | null;

  @IsOptional()
  @Truncate(500)
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
  @Truncate(1000)
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
  @Truncate(80)
  @IsString()
  @MaxLength(80)
  externalCode?: string;

  @IsOptional()
  @Truncate(200)
  @IsString()
  @MaxLength(200)
  manufacturerName?: string;

  @IsOptional()
  @Truncate(120)
  @IsString()
  @MaxLength(120)
  reference?: string;

  @IsOptional()
  @Truncate(80)
  @IsString()
  @MaxLength(80)
  color?: string;

  @IsOptional()
  @Truncate(500)
  @IsString()
  @MaxLength(500)
  approvedFor?: string;

  @IsOptional()
  @Truncate(500)
  @IsString()
  @MaxLength(500)
  restriction?: string;

  @IsOptional()
  @Truncate(2000)
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
