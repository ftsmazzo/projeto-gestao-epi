import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ServedClientStatus } from '@prisma/client';

export class CreateServedClientDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  legalName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  tradeName?: string;

  @IsString()
  @MinLength(14)
  @MaxLength(18)
  cnpj!: string;

  @IsInt()
  @Min(0)
  allocatedLifeQuota!: number;

  @IsOptional()
  @IsEnum(ServedClientStatus)
  status?: ServedClientStatus;

  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  contactEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  contactPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  /** Se informado junto com e-mail, cria gestor inicial com senha temporaria. */
  @IsOptional()
  @ValidateIf((o: CreateServedClientDto) => !!o.initialManagerEmail)
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  initialManagerName?: string;

  @IsOptional()
  @ValidateIf((o: CreateServedClientDto) => !!o.initialManagerName)
  @IsEmail()
  @MaxLength(200)
  initialManagerEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  initialManagerPhone?: string;
}
