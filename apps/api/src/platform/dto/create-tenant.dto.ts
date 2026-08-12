import { Type } from 'class-transformer';
import { IsEmail, IsInt, IsString, Min, MinLength } from 'class-validator';

export class CreatePlatformTenantDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @MinLength(2)
  ownerName!: string;

  @IsEmail()
  ownerEmail!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  contractedLifeQuota!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  wholesaleUnitPriceCents!: number;
}
