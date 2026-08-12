import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class UpdateLifePricingDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  unitPriceCents?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  defaultTrialDays?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  defaultTrialLives?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  contractedLifeQuota?: number;
}

export class LifeReducerItemDto {
  @IsInt()
  @Min(1)
  minLives!: number;

  @IsInt()
  @Min(1)
  @Max(90)
  percentOff!: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  label?: string | null;
}

export class ReplaceLifeReducersDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LifeReducerItemDto)
  items!: LifeReducerItemDto[];
}

export class StartTrialDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  days?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  lives?: number;
}

export class ActivateSubscriptionDto {
  @IsInt()
  @Min(1)
  lives!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  monthlyPriceCentsOverride?: number | null;
}

export class GrantLivesDto {
  @IsInt()
  @Min(1)
  extraLives!: number;
}

export class AdjustMonthlyDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  monthlyPriceCents?: number | null;
}

export class SuspendSubscriptionDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}

export class ReactivateSubscriptionDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  lives?: number;
}
