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
import { CreateWorkerDto } from './dto/create-worker.dto';
import { UpdateWorkerDto } from './dto/update-worker.dto';
import { UpdateWorkerStatusDto } from './dto/update-worker-status.dto';
import {
  ConfirmWorkerImportDto,
  PreviewWorkerImportDto,
} from './dto/worker-import.dto';
import { WORKER_CSV_TEMPLATE } from './worker-import.utils';
import { WorkerImportService } from './worker-import.service';
import { WorkersService } from './workers.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class WorkersController {
  constructor(
    private readonly workers: WorkersService,
    private readonly workerImport: WorkerImportService,
  ) {}

  @Get('served-clients/:servedClientId/workers')
  listByServedClient(
    @CurrentUser() user: JwtPayload,
    @Param('servedClientId') servedClientId: string,
  ) {
    return this.workers.listByServedClient(user.organizationId, servedClientId);
  }

  @Get('served-clients/:servedClientId/life-summary')
  lifeSummary(
    @CurrentUser() user: JwtPayload,
    @Param('servedClientId') servedClientId: string,
  ) {
    return this.workers.getClientLifeSummary(
      user.organizationId,
      servedClientId,
    );
  }

  @Get('served-clients/:servedClientId/workers/import/csv-template')
  csvTemplate() {
    return {
      fileName: 'modelo-importacao-trabalhadores.csv',
      contentType: 'text/csv; charset=utf-8',
      csvText: WORKER_CSV_TEMPLATE,
    };
  }

  @Post('served-clients/:servedClientId/workers/import/preview')
  previewImport(
    @CurrentUser() user: JwtPayload,
    @Param('servedClientId') servedClientId: string,
    @Body() dto: PreviewWorkerImportDto,
  ) {
    return this.workerImport.preview(
      user.organizationId,
      servedClientId,
      dto.csvText,
    );
  }

  @Post('served-clients/:servedClientId/workers/import/confirm')
  confirmImport(
    @CurrentUser() user: JwtPayload,
    @Param('servedClientId') servedClientId: string,
    @Body() dto: ConfirmWorkerImportDto,
  ) {
    return this.workerImport.confirm(
      user.organizationId,
      user.sub,
      servedClientId,
      dto.rows.map((row) => ({
        rowNumber: row.rowNumber,
        payload: {
          name: row.payload.name,
          cpf: row.payload.cpf ?? null,
          registration: row.payload.registration ?? null,
          email: row.payload.email ?? null,
          phone: row.payload.phone ?? null,
          admissionDate: row.payload.admissionDate ?? null,
          status: row.payload.status,
          operationalUnitId: row.payload.operationalUnitId ?? null,
          clientSectorId: row.payload.clientSectorId ?? null,
          clientJobFunctionId: row.payload.clientJobFunctionId ?? null,
          department: row.payload.department ?? null,
          role: row.payload.role ?? null,
        },
      })),
    );
  }

  @Post('served-clients/:servedClientId/workers')
  create(
    @CurrentUser() user: JwtPayload,
    @Param('servedClientId') servedClientId: string,
    @Body() dto: CreateWorkerDto,
  ) {
    return this.workers.create(
      user.organizationId,
      user.sub,
      servedClientId,
      dto,
    );
  }

  @Get('workers/:id')
  getById(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.workers.getById(user.organizationId, id);
  }

  @Patch('workers/:id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateWorkerDto,
  ) {
    return this.workers.update(user.organizationId, user.sub, id, dto);
  }

  @Patch('workers/:id/status')
  updateStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateWorkerStatusDto,
  ) {
    return this.workers.updateStatus(
      user.organizationId,
      user.sub,
      id,
      dto.status,
    );
  }
}
