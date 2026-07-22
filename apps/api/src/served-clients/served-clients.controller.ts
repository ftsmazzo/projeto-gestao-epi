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
import { CreateServedClientDto } from './dto/create-served-client.dto';
import { UpdateServedClientDto } from './dto/update-served-client.dto';
import { UpdateServedClientStatusDto } from './dto/update-served-client-status.dto';
import { ServedClientsService } from './served-clients.service';

@Controller('served-clients')
@UseGuards(JwtAuthGuard)
export class ServedClientsController {
  constructor(private readonly servedClients: ServedClientsService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.servedClients.list(user.organizationId);
  }

  @Get('quota-summary')
  quotaSummary(@CurrentUser() user: JwtPayload) {
    return this.servedClients.getQuotaSummary(user.organizationId);
  }

  @Get(':id')
  getById(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.servedClients.getById(user.organizationId, id);
  }

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateServedClientDto) {
    return this.servedClients.create(user.organizationId, user.sub, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateServedClientDto,
  ) {
    return this.servedClients.update(user.organizationId, user.sub, id, dto);
  }

  @Patch(':id/status')
  updateStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateServedClientStatusDto,
  ) {
    return this.servedClients.updateStatus(
      user.organizationId,
      user.sub,
      id,
      dto.status,
    );
  }
}
