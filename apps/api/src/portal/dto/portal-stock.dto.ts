import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class PortalStockEntradaItemDto {
  @IsString()
  epiItemId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class PortalStockEntradasDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PortalStockEntradaItemDto)
  items!: PortalStockEntradaItemDto[];
}
