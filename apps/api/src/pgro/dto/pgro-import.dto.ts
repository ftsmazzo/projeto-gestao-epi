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
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { OccupationalRiskCategory } from '@prisma/client';
import { PGRO_MAX_NAME_LENGTH } from '../pgro-limits';

/** Trunca textos longos do PGR antes do MaxLength. */
function Truncate(max: number) {
  return Transform(({ value }: { value: unknown }) => {
    if (value == null || typeof value !== 'string') return value;
    const trimmed = value.trim();
    if (!trimmed) return value;
    return trimmed.length > max ? trimmed.slice(0, max).trimEnd() : trimmed;
  });
}

export class ConfirmPgroCompanyDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  legalName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  tradeName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  cnpj?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  allocatedLifeQuota?: number;

  /** Contato institucional do cliente (alertas diarios). */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  contactEmail?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  contactPhone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  addressLine?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  state?: string | null;
}

export class ConfirmPgroInitialManagerDto {
  @Truncate(PGRO_MAX_NAME_LENGTH)
  @IsString()
  @MinLength(2)
  @MaxLength(PGRO_MAX_NAME_LENGTH)
  name!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(200)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string | null;
}

export class ConfirmPgroSectorDto {
  @IsString()
  tempId!: string;

  @Truncate(PGRO_MAX_NAME_LENGTH)
  @IsString()
  @MinLength(2)
  @MaxLength(PGRO_MAX_NAME_LENGTH)
  name!: string;

  @IsBoolean()
  included!: boolean;
}

export class ConfirmPgroFunctionDto {
  @IsString()
  tempId!: string;

  @Truncate(PGRO_MAX_NAME_LENGTH)
  @IsString()
  @MinLength(2)
  @MaxLength(PGRO_MAX_NAME_LENGTH)
  name!: string;

  @IsOptional()
  @Truncate(PGRO_MAX_NAME_LENGTH)
  @IsString()
  @MaxLength(PGRO_MAX_NAME_LENGTH)
  sectorName?: string | null;

  @IsOptional()
  @Truncate(2000)
  @IsString()
  @MaxLength(2000)
  activityDescription?: string | null;

  @IsOptional()
  @Truncate(2000)
  @IsString()
  @MaxLength(2000)
  environmentDescription?: string | null;

  @IsBoolean()
  included!: boolean;
}

export class ConfirmPgroRiskDto {
  @IsString()
  tempId!: string;

  @Truncate(PGRO_MAX_NAME_LENGTH)
  @IsString()
  @MinLength(2)
  @MaxLength(PGRO_MAX_NAME_LENGTH)
  name!: string;

  @IsEnum(OccupationalRiskCategory)
  category!: OccupationalRiskCategory;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  functionNames?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  exposure?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  source?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  possibleDamage?: string | null;

  @IsBoolean()
  included!: boolean;
}

export class ConfirmPgroEpiNeedDto {
  @IsString()
  tempId!: string;

  @Truncate(PGRO_MAX_NAME_LENGTH)
  @IsString()
  @MinLength(2)
  @MaxLength(PGRO_MAX_NAME_LENGTH)
  suggestedName!: string;

  @IsOptional()
  @IsString()
  matchedEpiNeedId?: string | null;

  @IsBoolean()
  createNew!: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  functionNames?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  riskNames?: string[];

  @IsBoolean()
  included!: boolean;
}

export class ConfirmPgroImportDto {
  @IsOptional()
  @IsString()
  servedClientId?: string | null;

  @IsOptional()
  @IsBoolean()
  archiveMissing?: boolean;

  @IsOptional()
  @IsBoolean()
  skipCompanyUpdate?: boolean;

  @ValidateNested()
  @Type(() => ConfirmPgroCompanyDto)
  company!: ConfirmPgroCompanyDto;

  /** Se informado, cria gestor do portal e dispara convite (e-mail/WhatsApp). */
  @IsOptional()
  @ValidateNested()
  @Type(() => ConfirmPgroInitialManagerDto)
  initialManager?: ConfirmPgroInitialManagerDto | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConfirmPgroSectorDto)
  sectors!: ConfirmPgroSectorDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConfirmPgroFunctionDto)
  functions!: ConfirmPgroFunctionDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConfirmPgroRiskDto)
  risks!: ConfirmPgroRiskDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConfirmPgroEpiNeedDto)
  epiNeeds!: ConfirmPgroEpiNeedDto[];

  /** Override explicito quando cobertura tabular de GHE esta incompleta. */
  @IsOptional()
  @IsBoolean()
  forceConfirmWeakCoverage?: boolean;
}
