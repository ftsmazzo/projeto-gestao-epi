import { IsEnum } from 'class-validator';
import { ServedClientStatus } from '@prisma/client';

export class UpdateServedClientStatusDto {
  @IsEnum(ServedClientStatus)
  status!: ServedClientStatus;
}
