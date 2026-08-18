import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { SstDocumentType } from '@prisma/client';
import type { Response } from 'express';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { CurrentUser } from '../auth/current-user.decorator';
import { ClientJwtAuthGuard } from '../auth/jwt-auth.guard';
import type { ClientJwtPayload } from '../auth/types/jwt-payload';
import { SstDocumentsService } from './sst-documents.service';

class CreateSstDocumentDto {
  @IsString()
  workerId!: string;

  @IsEnum(SstDocumentType)
  type!: SstDocumentType;

  /** Data em que o documento SST foi feito. Vazio = data/hora atuais. */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Data do documento deve estar no formato AAAA-MM-DD.',
  })
  documentDate?: string;
}

class UpsertSstProfileDto {
  @IsOptional()
  @IsString()
  technicalResponsibleName?: string;

  @IsOptional()
  @IsString()
  technicalResponsibleRegistry?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24)
  integrationDurationHours?: number;

  @IsOptional()
  @IsString()
  integrationTime?: string;
}

@Controller('portal/sst-documents')
@UseGuards(ClientJwtAuthGuard)
export class PortalSstDocumentsController {
  constructor(private readonly sst: SstDocumentsService) {}

  @Get()
  list(@CurrentUser() user: ClientJwtPayload) {
    this.assertClient(user);
    return this.sst.list(user.organizationId, user.servedClientId);
  }

  @Get('profile')
  profile(@CurrentUser() user: ClientJwtPayload) {
    this.assertClient(user);
    return this.sst.getProfile(user.organizationId, user.servedClientId);
  }

  @Get('profile/logo')
  logo(@CurrentUser() user: ClientJwtPayload, @Res() res: Response) {
    this.assertClient(user);
    return this.sst.streamCompanyLogo(
      user.organizationId,
      user.servedClientId,
      res,
    );
  }

  @Post('profile/logo')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  uploadLogo(
    @CurrentUser() user: ClientJwtPayload,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    this.assertClient(user);
    return this.sst.uploadCompanyLogo(
      user.organizationId,
      user.servedClientId,
      user.sub,
      file,
    );
  }

  @Delete('profile/logo')
  deleteLogo(@CurrentUser() user: ClientJwtPayload) {
    this.assertClient(user);
    return this.sst.deleteCompanyLogo(
      user.organizationId,
      user.servedClientId,
      user.sub,
    );
  }

  @Put('profile')
  saveProfile(
    @CurrentUser() user: ClientJwtPayload,
    @Body() dto: UpsertSstProfileDto,
  ) {
    this.assertClient(user);
    return this.sst.upsertProfile(
      user.organizationId,
      user.servedClientId,
      user.sub,
      dto,
    );
  }

  @Post()
  create(
    @CurrentUser() user: ClientJwtPayload,
    @Body() dto: CreateSstDocumentDto,
  ) {
    this.assertClient(user);
    return this.sst.createAndSend(
      user.organizationId,
      user.servedClientId,
      user.sub,
      dto,
    );
  }

  @Post(':id/link')
  resend(
    @CurrentUser() user: ClientJwtPayload,
    @Param('id') id: string,
  ) {
    this.assertClient(user);
    return this.sst.resendLink(
      user.organizationId,
      user.servedClientId,
      user.sub,
      id,
    );
  }

  @Get(':id/pdf')
  async pdf(
    @CurrentUser() user: ClientJwtPayload,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    this.assertClient(user);
    const { buffer, fileName } = await this.sst.getPdf(
      user.organizationId,
      user.servedClientId,
      id,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileName}"`,
    );
    res.send(buffer);
  }

  private assertClient(user: ClientJwtPayload) {
    if (!user.servedClientId) {
      throw new NotFoundException('Cliente do portal nao identificado.');
    }
  }
}
