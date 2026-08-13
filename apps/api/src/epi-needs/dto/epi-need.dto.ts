import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { EpiCategory, EpiUsefulLifeUnit } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateEpiNeedDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsEnum(EpiCategory)
  category?: EpiCategory;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  aliases?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  usefulLifeValue?: number;

  @IsOptional()
  @IsEnum(EpiUsefulLifeUnit)
  usefulLifeUnit?: EpiUsefulLifeUnit;
}

export class UpdateEpiNeedDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsEnum(EpiCategory)
  category?: EpiCategory | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  aliases?: string[] | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  usefulLifeValue?: number | null;

  @IsOptional()
  @IsEnum(EpiUsefulLifeUnit)
  usefulLifeUnit?: EpiUsefulLifeUnit | null;
}

export class UpdateEpiNeedStatusDto {
  @IsBoolean()
  isActive!: boolean;
}

export class LinkEpiNeedItemDto {
  @IsString()
  epiItemId!: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class SyncEpiItemNeedsDto {
  @IsArray()
  @IsString({ each: true })
  needIds!: string[];
}

export class MatchEpiNeedsDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  equipmentName?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  technicalNotes?: string;
}
