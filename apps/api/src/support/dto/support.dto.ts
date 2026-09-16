import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const SUPPORT_SCOPE_VALUES = ['CONSULTORIA', 'CLIENTE'] as const;
type SupportScopeValue = (typeof SUPPORT_SCOPE_VALUES)[number];

export class SupportLoadThreadQueryDto {
  @IsOptional()
  @IsEnum(SUPPORT_SCOPE_VALUES)
  scope?: SupportScopeValue;

  @IsOptional()
  @IsString()
  servedClientId?: string;
}

export class SupportSendMessageDto {
  @IsOptional()
  @IsEnum(SUPPORT_SCOPE_VALUES)
  scope?: SupportScopeValue;

  @IsOptional()
  @IsString()
  servedClientId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body!: string;
}

export class SupportEscalateDto {
  @IsOptional()
  @IsEnum(SUPPORT_SCOPE_VALUES)
  scope?: SupportScopeValue;

  @IsOptional()
  @IsString()
  servedClientId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  reason?: string;
}
