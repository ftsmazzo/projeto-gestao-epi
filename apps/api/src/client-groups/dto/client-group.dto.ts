import { ClientUserRole } from '@prisma/client';
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateClientGroupDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}

export class UpdateClientGroupDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}

export class SetClientGroupMembersDto {
  @IsArray()
  @IsString({ each: true })
  servedClientIds!: string[];
}

export class GrantClientGroupAccessDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @IsEmail()
  @MaxLength(200)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string | null;

  @IsEnum(ClientUserRole)
  role!: ClientUserRole;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  servedClientIds!: string[];
}
