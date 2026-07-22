import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Query,
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

  /**
   * Busca dinamica — deve ficar ANTES de certificates/:caNumber
   * para o Nest nao interpretar "search" como numero de CA.
   */
  @Get('certificates/search')
  search(
    @Query('q') q?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.caepi.searchCertificates(q ?? '', limit);
  }

  @Get('certificates/:caNumber')
  findByCaNumber(@Param('caNumber') caNumber: string) {
    return this.caepi.findByCaNumber(caNumber);
  }

  @Post('import')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 120 * 1024 * 1024 },
    }),
  )
  importFile(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file?: UploadedCaepiFile,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException(
        'Envie o arquivo CAEPI no campo multipart "file" (CSV, TXT ou XLSX).',
      );
    }

    const name = (file.originalname || '').toLowerCase();
    const allowed =
      !name ||
      name.endsWith('.csv') ||
      name.endsWith('.txt') ||
      name.endsWith('.tsv') ||
      name.endsWith('.xlsx') ||
      name.endsWith('.xls');

    if (!allowed) {
      throw new BadRequestException(
        'Formato nao suportado. Use arquivo .csv, .txt ou .xlsx da base CAEPI.',
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
