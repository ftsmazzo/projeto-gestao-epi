import { IsEnum } from 'class-validator';
import { OperationalUnitStatus } from '@prisma/client';

export class UpdateOperationalUnitStatusDto {
  @IsEnum(OperationalUnitStatus)
  status!: OperationalUnitStatus;
}
