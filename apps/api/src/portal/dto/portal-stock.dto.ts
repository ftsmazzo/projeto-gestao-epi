import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsEnum,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { EpiUsefulLifeUnit } from '@prisma/client';

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

  /** Nome do EPI para entrada manual sem CA (ex.: colete refletivo). */
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  manualEpiName?: string;

  /** Descricao livre do EPI manual sem CA. */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  manualDescription?: string;

  /** Periodo de uso/vida util do EPI manual. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  manualUsefulLifeValue?: number;

  @IsOptional()
  @IsEnum(EpiUsefulLifeUnit)
  manualUsefulLifeUnit?: EpiUsefulLifeUnit;

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

/** Baixa manual para corrigir entrada errada ou descarte. */
export class PortalStockSaidaDto {
  @IsString()
  epiItemId!: string;

  @IsOptional()
  @IsString()
  stockLocationId?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @IsString()
  @MinLength(3)
  @MaxLength(300)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
