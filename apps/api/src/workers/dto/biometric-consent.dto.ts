import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class GrantWorkerBiometricConsentDto {
  @IsBoolean()
  accepted!: boolean;
}

export class RevokeWorkerBiometricConsentDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string | null;
}
