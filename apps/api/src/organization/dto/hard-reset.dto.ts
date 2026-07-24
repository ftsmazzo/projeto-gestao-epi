import { IsString, MaxLength, MinLength } from 'class-validator';

export class HardResetDto {
  @IsString()
  @MinLength(7)
  @MaxLength(20)
  confirmation!: string;
}
