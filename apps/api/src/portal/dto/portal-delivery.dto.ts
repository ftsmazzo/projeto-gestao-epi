import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class PortalDeliveryItemDto {
  @IsString()
  @MinLength(1)
  epiNeedId!: string;

  @IsString()
  @MinLength(1)
  epiItemId!: string;

  @IsOptional()
  @IsString()
  epiVariantId?: string | null;

  @IsString()
  @MinLength(1)
  stockLocationId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class PortalCreateDeliveryPayloadDto {
  @IsString()
  @MinLength(1)
  workerId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PortalDeliveryItemDto)
  items!: PortalDeliveryItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}
