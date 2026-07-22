import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/types/jwt-payload';
import { CaepiService } from './caepi.service';

type UploadedCaepiFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

@Controller('caepi')
@UseGuards(JwtAuthGuard)
export class CaepiController {
  constructor(private readonly caepi: CaepiService) {}

  @Get('certificates/:caNumber')
  findByCaNumber(@Param('caNumber') caNumber: string) {
    return this.caepi.findByCaNumber(caNumber);
  }

  @Post('import')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 80 * 1024 * 1024 },
    }),
  )
  importFile(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file?: UploadedCaepiFile,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException(
        'Envie o arquivo CAEPI no campo multipart "file" (CSV ou TXT).',
      );
    }

    const name = (file.originalname || '').toLowerCase();
    if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      throw new BadRequestException(
        'Nesta etapa, importe CSV/TXT. Exporte a planilha CAEPI para CSV e tente novamente.',
      );
    }
    if (
      name &&
      !name.endsWith('.csv') &&
      !name.endsWith('.txt') &&
      !name.endsWith('.tsv')
    ) {
      throw new BadRequestException(
        'Formato nao suportado. Use arquivo .csv ou .txt da base CAEPI.',
      );
    }

    return this.caepi.importFromBuffer(file.buffer, {
      organizationId: user.organizationId,
      userId: user.sub,
      membershipRole: user.membershipRole,
      originalName: file.originalname,
    });
  }
}
