import { IsString, MinLength } from 'class-validator';

export class DestroyPlatformTenantDto {
  @IsString()
  @MinLength(2)
  confirmation!: string;
}
