import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RunDailyAlertsDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  servedClientId?: string;
}
