import { IsEnum } from 'class-validator';
import { EpiItemStatus } from '@prisma/client';

export class UpdateEpiItemStatusDto {
  @IsEnum(EpiItemStatus)
  status!: EpiItemStatus;
}
