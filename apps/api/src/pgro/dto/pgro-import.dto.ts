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
import { Type } from 'class-transformer';
import { OccupationalRiskCategory } from '@prisma/client';

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
}

export class ConfirmPgroSectorDto {
  @IsString()
  tempId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @IsBoolean()
  included!: boolean;
}

export class ConfirmPgroFunctionDto {
  @IsString()
  tempId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  sectorName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  activityDescription?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  environmentDescription?: string | null;

  @IsBoolean()
  included!: boolean;
}

export class ConfirmPgroRiskDto {
  @IsString()
  tempId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @IsEnum(OccupationalRiskCategory)
  category!: OccupationalRiskCategory;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  functionNames?: string[];

  @IsBoolean()
  included!: boolean;
}

export class ConfirmPgroEpiNeedDto {
  @IsString()
  tempId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
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

  @ValidateNested()
  @Type(() => ConfirmPgroCompanyDto)
  company!: ConfirmPgroCompanyDto;

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
}
