import { IsEmail, IsIn, IsString } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail()
  email!: string;

  /** portal = painel do cliente; consultoria = gestao */
  @IsString()
  @IsIn(['portal', 'consultoria'])
  audience!: 'portal' | 'consultoria';
}
