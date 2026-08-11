import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { MembershipRole } from '@prisma/client';

export class CreateOrganizationMemberDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsEmail()
  @MaxLength(180)
  email!: string;

  /** WhatsApp opcional para envio do convite. */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  /** ADMIN ou MEMBER. OWNER so via transferencia. */
  @IsEnum(MembershipRole)
  role!: MembershipRole;
}

export class UpdateOrganizationMemberRoleDto {
  @IsEnum(MembershipRole)
  role!: MembershipRole;
}

export class TransferOrganizationOwnershipDto {
  @IsString()
  @MinLength(1)
  membershipId!: string;
}
