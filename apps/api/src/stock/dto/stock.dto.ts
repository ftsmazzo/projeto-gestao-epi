import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { EpiStockMovementType } from '@prisma/client';

export class CreateStockLocationDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateStockLocationDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;
}

export class UpdateStockLocationStatusDto {
  @IsBoolean()
  isActive!: boolean;
}

export class CreateStockMovementDto {
  @IsEnum(EpiStockMovementType)
  type!: EpiStockMovementType;

  @IsString()
  stockLocationId!: string;

  @IsString()
  epiItemId!: string;

  @IsOptional()
  @IsString()
  epiVariantId?: string | null;

  @IsInt()
  @Min(0)
  quantity!: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  minQuantity?: number | null;
}
