import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  EpiRequirementSource,
  OccupationalRiskCategory,
  RiskLevel,
} from '@prisma/client';

export class CreateClientSectorDto {
  @IsString()
  servedClientId!: string;

  @IsOptional()
  @IsString()
  operationalUnitId?: string | null;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}

export class UpdateClientSectorDto {
  @IsOptional()
  @IsString()
  operationalUnitId?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;
}

export class UpdateStatusDto {
  @IsBoolean()
  isActive!: boolean;
}

export class CreateClientJobFunctionDto {
  @IsString()
  servedClientId!: string;

  @IsString()
  sectorId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  environmentDescription?: string;
}

export class UpdateClientJobFunctionDto {
  @IsOptional()
  @IsString()
  sectorId?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  environmentDescription?: string | null;
}

export class CreateOccupationalRiskDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @IsEnum(OccupationalRiskCategory)
  category!: OccupationalRiskCategory;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsString({ each: true })
  aliases?: string[];
}

export class UpdateOccupationalRiskDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsEnum(OccupationalRiskCategory)
  category?: OccupationalRiskCategory;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @IsOptional()
  @IsString({ each: true })
  aliases?: string[] | null;
}

export class LinkJobFunctionRiskDto {
  @IsString()
  riskId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  exposure?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  source?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  possibleDamage?: string;

  @IsOptional()
  @IsEnum(RiskLevel)
  riskLevel?: RiskLevel;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class CreateJobFunctionEpiRequirementDto {
  @IsString()
  epiNeedId!: string;

  @IsOptional()
  @IsString()
  riskId?: string | null;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  replacementIntervalDays?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;

  @IsOptional()
  @IsEnum(EpiRequirementSource)
  source?: EpiRequirementSource;
}

export class UpdateJobFunctionEpiRequirementDto {
  @IsOptional()
  @IsString()
  epiNeedId?: string;

  @IsOptional()
  @IsString()
  riskId?: string | null;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  replacementIntervalDays?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;

  @IsOptional()
  @IsEnum(EpiRequirementSource)
  source?: EpiRequirementSource;
}
