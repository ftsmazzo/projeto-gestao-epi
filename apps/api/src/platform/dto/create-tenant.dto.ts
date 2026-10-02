import { Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreatePlatformTenantDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @MinLength(2)
  ownerName!: string;

  @IsEmail()
  ownerEmail!: string;

  @IsString()
  @MinLength(10)
  ownerPhone!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  contractedLifeQuota!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  wholesaleUnitPriceCents!: number;

  @IsOptional()
  @IsIn(['CONSULTORIA', 'DISTRIBUIDORA'])
  kind?: 'CONSULTORIA' | 'DISTRIBUIDORA';
}
