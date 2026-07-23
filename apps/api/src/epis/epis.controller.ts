import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/types/jwt-payload';
import { CreateEpiItemDto } from './dto/create-epi-item.dto';
import {
  ConfirmEpiImportDto,
  PreviewEpiImportDto,
} from './dto/epi-import.dto';
import { UpdateEpiItemDto } from './dto/update-epi-item.dto';
import { UpdateEpiItemStatusDto } from './dto/update-epi-item-status.dto';
import { EPI_CSV_TEMPLATE } from './epi-import.utils';
import { EpiImportService } from './epi-import.service';
import { EpisService } from './epis.service';

@Controller('epis')
@UseGuards(JwtAuthGuard)
export class EpisController {
  constructor(
    private readonly epis: EpisService,
    private readonly epiImport: EpiImportService,
  ) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.epis.list(user.organizationId);
  }

  @Get('import/csv-template')
  csvTemplate() {
    return {
      fileName: 'modelo-importacao-epis.csv',
      contentType: 'text/csv; charset=utf-8',
      csvText: EPI_CSV_TEMPLATE,
    };
  }

  @Post('import/preview')
  previewImport(
    @CurrentUser() user: JwtPayload,
    @Body() dto: PreviewEpiImportDto,
  ) {
    return this.epiImport.preview(user.organizationId, dto.csvText);
  }

  @Post('import/confirm')
  confirmImport(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ConfirmEpiImportDto,
  ) {
    return this.epiImport.confirm(
      user.organizationId,
      user.sub,
      dto.rows.map((row) => ({
        rowNumber: row.rowNumber,
        payload: {
          name: row.payload.name,
          description: row.payload.description ?? null,
          requiresCa: row.payload.requiresCa,
          caNumber: row.payload.caNumber ?? null,
          caExpiresAt: row.payload.caExpiresAt ?? null,
          unitOfMeasure: row.payload.unitOfMeasure,
          usefulLifeValue: row.payload.usefulLifeValue ?? null,
          usefulLifeUnit: row.payload.usefulLifeUnit ?? null,
          category: row.payload.category ?? null,
          externalCode: row.payload.externalCode ?? null,
          manufacturerName: row.payload.manufacturerName ?? null,
          reference: row.payload.reference ?? null,
          color: row.payload.color ?? null,
          approvedFor: row.payload.approvedFor ?? null,
          restriction: row.payload.restriction ?? null,
          technicalNotes: row.payload.technicalNotes ?? null,
          nrr: row.payload.nrr ?? null,
          nrrsf: row.payload.nrrsf ?? null,
          variant: row.payload.variant
            ? {
                size: row.payload.variant.size ?? null,
                color: row.payload.variant.color ?? null,
                model: row.payload.variant.model ?? null,
                side: row.payload.variant.side ?? null,
                notes: row.payload.variant.notes ?? null,
              }
            : null,
        },
      })),
    );
  }

  @Get(':id')
  getById(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.epis.getById(user.organizationId, id);
  }

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateEpiItemDto) {
    return this.epis.create(user.organizationId, user.sub, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateEpiItemDto,
  ) {
    return this.epis.update(user.organizationId, user.sub, id, dto);
  }

  @Patch(':id/status')
  updateStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateEpiItemStatusDto,
  ) {
    return this.epis.updateStatus(
      user.organizationId,
      user.sub,
      id,
      dto.isActive,
    );
  }
}
