import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreateDistributorProductDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @MinLength(1)
  internalSku!: string;

  @IsOptional()
  @IsString()
  supplierSku?: string;

  @IsOptional()
  @IsString()
  ncm?: string;

  @IsOptional()
  @IsString()
  caNumber?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minQuantity?: number;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  variants!: string[];
}

export class UpdateDistributorProductDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minQuantity?: number | null;

  @IsOptional()
  @IsString()
  caNumber?: string | null;
}

export class AddDistributorVariantDto {
  @IsString()
  @MinLength(1)
  label!: string;
}

export class ManualDistributorMovementDto {
  @IsString()
  variantId!: string;

  @IsIn(['IN', 'OUT'])
  direction!: 'IN' | 'OUT';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class LinkInboundLineDto {
  @IsOptional()
  @IsString()
  variantId?: string | null;
}
