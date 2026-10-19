import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
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

  @IsOptional()
  @IsString()
  unitCode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  itemsPerBox?: number | null;

  @IsOptional()
  @IsString()
  gtin?: string | null;

  @IsOptional()
  @IsString()
  warehouseLocation?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  costCents?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1000)
  lengthCm?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1000)
  widthCm?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1000)
  heightCm?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  netWeightKg?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  grossWeightKg?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1000)
  boxLengthCm?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1000)
  boxWidthCm?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1000)
  boxHeightCm?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(8)
  originCode?: number;

  @IsOptional()
  @IsString()
  cest?: string | null;

  @IsOptional()
  @IsString()
  saleCfopIn?: string;

  @IsOptional()
  @IsString()
  saleCfopOut?: string;

  @IsOptional()
  @IsString()
  buyCfopIn?: string;

  @IsOptional()
  @IsString()
  buyCfopOut?: string;

  @IsOptional()
  @IsBoolean()
  icmsSt?: boolean;

  @IsOptional()
  @IsBoolean()
  tracksLot?: boolean;
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

  @IsOptional()
  @IsString()
  ncm?: string | null;

  @IsOptional()
  @IsString()
  unitCode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  itemsPerBox?: number | null;

  @IsOptional()
  @IsString()
  gtin?: string | null;

  @IsOptional()
  @IsString()
  warehouseLocation?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  costCents?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1000)
  lengthCm?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1000)
  widthCm?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1000)
  heightCm?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  netWeightKg?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  grossWeightKg?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1000)
  boxLengthCm?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1000)
  boxWidthCm?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1000)
  boxHeightCm?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(8)
  originCode?: number;

  @IsOptional()
  @IsString()
  cest?: string | null;

  @IsOptional()
  @IsString()
  saleCfopIn?: string;

  @IsOptional()
  @IsString()
  saleCfopOut?: string;

  @IsOptional()
  @IsString()
  buyCfopIn?: string;

  @IsOptional()
  @IsString()
  buyCfopOut?: string;

  @IsOptional()
  @IsBoolean()
  icmsSt?: boolean;

  @IsOptional()
  @IsBoolean()
  tracksLot?: boolean;
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

  @IsOptional()
  @IsString()
  lotCode?: string | null;

  @IsOptional()
  @IsString()
  expiresOn?: string | null;
}

export class PurchaseOrderLineDto {
  @IsString()
  variantId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  unitCostCents?: number;

  @IsOptional()
  @IsString()
  lotCode?: string | null;

  @IsOptional()
  @IsString()
  expiresOn?: string | null;
}

export class CreatePurchaseOrderDto {
  @IsString()
  @MinLength(2)
  supplierName!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderLineDto)
  lines!: PurchaseOrderLineDto[];
}

export class RejectPurchaseOrderDto {
  @IsOptional()
  @IsString()
  note?: string;
}

export class QuoteLineDto {
  @IsString()
  variantId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  unitPriceCents!: number;

  @Type(() => Number)
  discountPercent!: number;
}

export class CreateQuoteDto {
  @IsString()
  @MinLength(2)
  customerName!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuoteLineDto)
  lines!: QuoteLineDto[];
}

export class SetSellerCeilingDto {
  @IsString()
  userId!: string;

  @Type(() => Number)
  maxDiscountPercent!: number;
}

export class LinkInboundLineDto {
  @IsOptional()
  @IsString()
  variantId?: string | null;

  @IsOptional()
  @IsString()
  lotCode?: string | null;

  @IsOptional()
  @IsString()
  expiresOn?: string | null;
}
