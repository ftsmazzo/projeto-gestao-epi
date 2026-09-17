import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const LIFECYCLE_VALUES = [
  'ACTIVE',
  'WAITING_HUMAN',
  'IN_PROGRESS',
  'RESOLVED',
] as const;
const SCOPE_VALUES = ['CONSULTORIA', 'CLIENTE'] as const;

export class PlatformSupportListQueryDto {
  @IsOptional()
  @IsEnum(LIFECYCLE_VALUES)
  status?: (typeof LIFECYCLE_VALUES)[number];

  @IsOptional()
  @IsEnum(SCOPE_VALUES)
  scope?: (typeof SCOPE_VALUES)[number];

  @IsOptional()
  @IsString()
  organizationId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

export class PlatformSupportMessagesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number;
}

export class PlatformSupportReplyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body!: string;
}
