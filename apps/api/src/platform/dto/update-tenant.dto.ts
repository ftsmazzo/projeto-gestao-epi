import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class UpdatePlatformTenantDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  contractedLifeQuota?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  wholesaleUnitPriceCents?: number;
}
