import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsString, Length } from 'class-validator';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { SstDocumentSignService } from './sst-document-sign.service';

class UnlockSstDto {
  @IsString()
  @Length(4, 14)
  cpfLast4!: string;
}

@Controller('public/sst-documents')
export class PublicSstDocumentsController {
  constructor(private readonly sign: SstDocumentSignService) {}

  @Post(':token/unlock')
  unlock(@Param('token') token: string, @Body() dto: UnlockSstDto) {
    return this.sign.unlock(token, dto.cpfLast4);
  }

  @Get(':token/pdf')
  async pdf(
    @Param('token') token: string,
    @Query('cpfLast4') cpfLast4: string | undefined,
    @Res() res: Response,
  ) {
    if (!cpfLast4?.trim()) {
      throw new BadRequestException('Informe os 4 ultimos digitos do CPF.');
    }
    const { buffer, fileName } = await this.sign.publicPdf(token, cpfLast4);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileName}"`,
    );
    res.send(buffer);
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
    return this.sign.complete(token, {
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
