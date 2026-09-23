import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/types/jwt-payload';
import { ConfirmPgroImportDto } from './dto/pgro-import.dto';
import {
  listAlternatePgroExtractionProfiles,
  PGRO_EXTRACTION_PROFILES,
} from './pgro-extraction-profiles';
import { PgroService } from './pgro.service';

@Controller('pgro')
@UseGuards(JwtAuthGuard)
export class PgroController {
  constructor(private readonly pgro: PgroService) {}

  @Get('extraction-profiles')
  listExtractionProfiles() {
    return {
      defaultProfileId: 'INSEG_OFFICIAL',
      profiles: PGRO_EXTRACTION_PROFILES,
      alternateProfiles: listAlternatePgroExtractionProfiles(),
    };
  }

  @Post('import/preview')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  preview(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
    @Body('servedClientId') servedClientId?: string,
    @Body('extractionProfile') extractionProfile?: string,
  ) {
    return this.pgro.preview(
      user.organizationId,
      user.sub,
      user.membershipRole,
      file,
      servedClientId,
      { extractionProfile },
    );
  }

  @Get('import-runs/:id')
  getRun(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.pgro.getRun(user.organizationId, id);
  }

  @Post('import-runs/:id/confirm')
  confirm(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: ConfirmPgroImportDto,
  ) {
    return this.pgro.confirm(
      user.organizationId,
      user.sub,
      user.membershipRole,
      id,
      dto,
    );
  }
}
