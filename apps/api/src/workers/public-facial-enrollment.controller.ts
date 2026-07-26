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
import { memoryStorage } from 'multer';
import { IsString, Length } from 'class-validator';
import { WorkerFacialEnrollmentService } from './worker-facial-enrollment.service';

class UnlockFacialEnrollmentDto {
  @IsString()
  @Length(4, 14)
  cpfLast4!: string;
}

/** Endpoints publicos (sem JWT) para autoenrollment facial via link. */
@Controller('public/facial-enrollment')
export class PublicFacialEnrollmentController {
  constructor(private readonly enrollment: WorkerFacialEnrollmentService) {}

  @Post(':token/unlock')
  unlock(
    @Param('token') token: string,
    @Body() dto: UnlockFacialEnrollmentDto,
  ) {
    return this.enrollment.unlock(token, dto.cpfLast4);
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
    @Body('consentAccepted') consentAcceptedRaw?: string,
    @Body('faceDescriptor') faceDescriptorRaw?: string,
    @Body('faceEngine') faceEngine?: string,
    @Body('faceEngineVersion') faceEngineVersion?: string,
    @Body('qualityScore') qualityScoreRaw?: string,
  ) {
    if (!facial?.buffer?.length) {
      throw new BadRequestException(
        'Envie a imagem no campo multipart "facial".',
      );
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
    const consentAccepted =
      consentAcceptedRaw === 'true' || consentAcceptedRaw === '1';
    const qualityScore = qualityScoreRaw
      ? Number.parseFloat(qualityScoreRaw)
      : null;

    return this.enrollment.complete(token, {
      cpfLast4,
      consentAccepted,
      file: { buffer: facial.buffer, mimeType: facial.mimetype },
      faceDescriptor: faceDescriptor as number[],
      faceEngine,
      faceEngineVersion,
      qualityScore: Number.isFinite(qualityScore) ? qualityScore : null,
    });
  }
}
