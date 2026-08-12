import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SuspendPlatformTenantDto {
  @IsOptional()
  @IsString()
  @MaxLength(280)
  reason?: string;
}
