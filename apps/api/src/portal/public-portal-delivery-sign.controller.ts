import {
  BadRequestException,
  Body,
  Controller,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsString, Length } from 'class-validator';
import { memoryStorage } from 'multer';
import { PortalService } from './portal.service';

class UnlockPortalDeliverySignDto {
  @IsString()
  @Length(4, 14)
  cpfLast4!: string;
}

@Controller('public/portal-entregas')
export class PublicPortalDeliverySignController {
  constructor(private readonly portal: PortalService) {}

  @Post(':token/unlock')
  unlock(@Param('token') token: string, @Body() dto: UnlockPortalDeliverySignDto) {
    return this.portal.unlockDeliverySignLink(token, dto.cpfLast4);
  }

  @Post(':token/complete')
  @UseInterceptors(
    FileInterceptor('facial', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  complete(
    @Param('token') token: string,
    @UploadedFile() facial: Express.Multer.File | undefined,
    @Body('cpfLast4') cpfLast4?: string,
    @Body('faceDescriptor') faceDescriptorRaw?: string,
    @Body('faceEngine') faceEngine?: string,
    @Body('livenessPassed') livenessPassedRaw?: string,
    @Body('livenessChallenge') livenessChallenge?: string,
  ) {
    if (!facial?.buffer?.length) {
      throw new BadRequestException('Envie a imagem no campo "facial".');
    }
    if (!cpfLast4?.trim()) {
      throw new BadRequestException('Informe os 4 ultimos digitos do CPF.');
    }
    if (!faceDescriptorRaw?.trim()) {
      throw new BadRequestException('Descritor facial obrigatorio.');
    }
    let faceDescriptor: unknown;
    try {
      faceDescriptor = JSON.parse(faceDescriptorRaw) as unknown;
    } catch {
      throw new BadRequestException('faceDescriptor JSON invalido.');
    }
    return this.portal.completeDeliverySignLink(token, {
      cpfLast4,
      file: { buffer: facial.buffer, mimeType: facial.mimetype },
      faceDescriptor: faceDescriptor as number[],
      faceEngine,
      livenessPassed:
        livenessPassedRaw === 'true' || livenessPassedRaw === '1',
      livenessChallenge: livenessChallenge?.trim() || null,
    });
  }
}
