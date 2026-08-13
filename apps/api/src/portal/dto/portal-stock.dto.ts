import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class PortalStockEntradaItemDto {
  /** Item real do catalogo (opcional se informar CA + necessidade). */
  @IsOptional()
  @IsString()
  epiItemId?: string;

  /** Necessidade gerada no cliente (PGRO/estrutura). */
  @IsOptional()
  @IsString()
  epiNeedId?: string;

  /** CA para achar ou criar o EPI real e vincular a necessidade. */
  @IsOptional()
  @IsString()
  @MinLength(3)
  caNumber?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  /** Custo unitario em centavos (BRL). Opcional na entrada. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  unitCostCents?: number;

  /** Nota fiscal / comprovante ja enviado via /portal/custos/invoices. */
  @IsOptional()
  @IsString()
  invoiceDocumentId?: string;
}

export class PortalStockEntradasDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PortalStockEntradaItemDto)
  items!: PortalStockEntradaItemDto[];
}
