import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Res,
  UseGuards,
} from '@nestjs/common';
import { SstDocumentType } from '@prisma/client';
import type { Response } from 'express';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { CurrentUser } from '../auth/current-user.decorator';
import { ClientJwtAuthGuard } from '../auth/jwt-auth.guard';
import type { ClientJwtPayload } from '../auth/types/jwt-payload';
import { SstDocumentsService } from './sst-documents.service';

class CreateSstDocumentDto {
  @IsString()
  workerId!: string;

  @IsEnum(SstDocumentType)
  type!: SstDocumentType;
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
