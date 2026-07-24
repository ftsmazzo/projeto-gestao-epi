import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ClientUserRole } from '@prisma/client';

export class CreateClientUserDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @IsEmail()
  @MaxLength(200)
  email!: string;

  @IsEnum(ClientUserRole)
  role!: ClientUserRole;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string | null;
}

export class UpdateClientUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  email?: string;

  @IsOptional()
  @IsEnum(ClientUserRole)
  role?: ClientUserRole;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string | null;
}

export class UpdateClientUserStatusDto {
  @IsBoolean()
  isActive!: boolean;
}

export class CreateInitialManagerDto {
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
}
