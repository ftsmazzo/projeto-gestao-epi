import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ServedClientStatus } from '@prisma/client';

export class UpdateServedClientDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  legalName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  tradeName?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(14)
  @MaxLength(18)
  cnpj?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  allocatedLifeQuota?: number;

  @IsOptional()
  @IsEnum(ServedClientStatus)
  status?: ServedClientStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}
