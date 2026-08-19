import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/types/jwt-payload';
import {
  GenerateTrainingDto,
  UpsertTrainingTemplateDto,
} from './dto/training.dto';
import { TrainingService } from './training.service';

@Controller('training-templates')
@UseGuards(JwtAuthGuard)
export class TrainingController {
  constructor(private readonly training: TrainingService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.training.list(user.organizationId);
  }

  @Post('seed-defaults')
  seed(@CurrentUser() user: JwtPayload) {
    return this.training.seedDefaults(user.organizationId, user.sub);
  }

  @Get('issuances')
  issuances(@CurrentUser() user: JwtPayload) {
    return this.training.listIssuances(user.organizationId);
  }

  @Get('issuances/:id/pdf')
  async reprint(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const result = await this.training.reprintPdf(user.organizationId, id);
    this.sendPdf(res, result.fileName, result.buffer);
  }

  @Get('generation-defaults')
  generationDefaults(
    @CurrentUser() user: JwtPayload,
    @Query('servedClientId') servedClientId: string,
  ) {
    return this.training.generationDefaults(
      user.organizationId,
      servedClientId,
    );
  }

  @Get(':id')
  get(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.training.get(user.organizationId, id);
  }

  @Post()
  create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpsertTrainingTemplateDto,
  ) {
    return this.training.create(user.organizationId, user.sub, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpsertTrainingTemplateDto,
  ) {
    return this.training.update(user.organizationId, user.sub, id, dto);
  }

  @Post(':id/generate')
  async generate(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: GenerateTrainingDto,
    @Res() res: Response,
  ) {
    const result = await this.training.generatePdf(
      user.organizationId,
      user.sub,
      id,
      dto,
    );
    this.sendPdf(res, result.fileName, result.buffer);
  }

  @Get(':id/assets/:kind')
  asset(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('kind') kind: string,
    @Res() res: Response,
  ) {
    return this.training.streamAsset(
      user.organizationId,
      id,
      this.training.parseAssetKind(kind),
      res,
    );
  }

  @Post(':id/assets/:kind')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 3 * 1024 * 1024 },
    }),
  )
  uploadAsset(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('kind') kind: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    return this.training.saveAsset(
      user.organizationId,
      user.sub,
      id,
      this.training.parseAssetKind(kind),
      file,
    );
  }

  @Delete(':id/assets/:kind')
  deleteAsset(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('kind') kind: string,
  ) {
    return this.training.deleteAsset(
      user.organizationId,
      user.sub,
      id,
      this.training.parseAssetKind(kind),
    );
  }

  private sendPdf(res: Response, fileName: string, buffer: Buffer) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileName.replace(/"/g, '')}"`,
    );
    res.send(buffer);
  }
}
