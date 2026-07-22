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
import { WorkersService } from './workers.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class WorkersController {
  constructor(private readonly workers: WorkersService) {}

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
