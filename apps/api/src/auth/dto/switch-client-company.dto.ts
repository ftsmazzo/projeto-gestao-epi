import { IsString, MinLength } from 'class-validator';

export class SwitchClientCompanyDto {
  @IsString()
  @MinLength(1)
  servedClientId!: string;
}
