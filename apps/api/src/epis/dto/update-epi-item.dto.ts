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
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  EpiCategory,
  EpiUnitOfMeasure,
  EpiUsefulLifeUnit,
} from '@prisma/client';
import { EpiVariantInputDto } from './create-epi-item.dto';

export class UpdateEpiItemDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name?: string;

  @IsOptional()
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
