import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  Equals,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export const FACIAL_EVIDENCE_CONSENT_VERSION = 'v1-2026-07';

export const FACIAL_EVIDENCE_CONSENT_TEXT =
  'Declaro que a imagem facial será registrada como evidência da entrega deste EPI e vinculada ao comprovante de fornecimento.';

export class PortalDeliveryItemDto {
  @IsString()
  @MinLength(1)
  epiNeedId!: string;

  @IsString()
  @MinLength(1)
  epiItemId!: string;

  @IsOptional()
  @IsString()
  epiVariantId?: string | null;

  @IsString()
  @MinLength(1)
  stockLocationId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class PortalCreateDeliveryPayloadDto {
  @IsString()
  @MinLength(1)
  workerId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PortalDeliveryItemDto)
  items!: PortalDeliveryItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  /** Confirmacao explicita do aviso de captura facial (obrigatoria). */
  @IsBoolean()
  @Equals(true, {
    message:
      'E necessario aceitar o aviso de registro da imagem facial como evidencia.',
  })
  facialEvidenceConsentAccepted!: boolean;
}
