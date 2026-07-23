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
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  EpiCategory,
  EpiUnitOfMeasure,
  EpiUsefulLifeUnit,
} from '@prisma/client';
import { EpiVariantInputDto } from './create-epi-item.dto';

function Truncate(max: number) {
  return Transform(({ value }: { value: unknown }) => {
    if (value == null || typeof value !== 'string') return value;
    const trimmed = value.trim();
    if (!trimmed) return value;
    return trimmed.length > max ? trimmed.slice(0, max).trimEnd() : trimmed;
  });
}

export class UpdateEpiItemDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @Truncate(1000)
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @IsOptional()
  @IsBoolean()
  requiresCa?: boolean;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== '')
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  caNumber?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== '')
  @IsDateString()
  caExpiresAt?: string | null;

  @IsOptional()
  @IsEnum(EpiUnitOfMeasure)
  unitOfMeasure?: EpiUnitOfMeasure;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(0)
  usefulLifeValue?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsEnum(EpiUsefulLifeUnit)
  usefulLifeUnit?: EpiUsefulLifeUnit | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsEnum(EpiCategory)
  category?: EpiCategory | null;

  @IsOptional()
  @Truncate(80)
  @IsString()
  @MaxLength(80)
  externalCode?: string | null;

  @IsOptional()
  @Truncate(200)
  @IsString()
  @MaxLength(200)
  manufacturerName?: string | null;

  @IsOptional()
  @Truncate(120)
  @IsString()
  @MaxLength(120)
  reference?: string | null;

  @IsOptional()
  @Truncate(80)
  @IsString()
  @MaxLength(80)
  color?: string | null;

  @IsOptional()
  @Truncate(500)
  @IsString()
  @MaxLength(500)
  approvedFor?: string | null;

  @IsOptional()
  @Truncate(500)
  @IsString()
  @MaxLength(500)
  restriction?: string | null;

  @IsOptional()
  @Truncate(2000)
  @IsString()
  @MaxLength(2000)
  technicalNotes?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsNumber()
  nrr?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsNumber()
  nrrsf?: number | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EpiVariantInputDto)
  variants?: EpiVariantInputDto[];
}
