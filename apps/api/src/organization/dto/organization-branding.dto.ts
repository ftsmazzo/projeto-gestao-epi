import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateOrganizationBrandingDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;
}
