import { IsBoolean } from 'class-validator';

export class UpdateEpiItemStatusDto {
  @IsBoolean()
  isActive!: boolean;
}
