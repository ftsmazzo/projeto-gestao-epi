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
import {
  CreateClientUserDto,
  CreateInitialManagerDto,
  UpdateClientUserDto,
  UpdateClientUserStatusDto,
} from './dto/client-user.dto';
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

  @Get(':id/overview')
  overview(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.servedClients.getOverview(user.organizationId, id);
  }

  @Get(':id/users')
  listUsers(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.servedClients.listClientUsers(user.organizationId, id);
  }

  @Post(':id/initial-manager')
  createInitialManager(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CreateInitialManagerDto,
  ) {
    return this.servedClients.createInitialManager(
      user.organizationId,
      user.sub,
      id,
      dto,
    );
  }

  @Post(':id/users')
  createUser(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CreateClientUserDto,
  ) {
    return this.servedClients.createClientUser(
      user.organizationId,
      user.sub,
      id,
      dto,
    );
  }

  @Post(':id/users/:membershipId/reset-access')
  resetAccess(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('membershipId') membershipId: string,
  ) {
    return this.servedClients.resetClientUserAccess(
      user.organizationId,
      user.sub,
      id,
      membershipId,
    );
  }

  @Patch(':id/users/:membershipId')
  updateUser(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('membershipId') membershipId: string,
    @Body() dto: UpdateClientUserDto,
  ) {
    return this.servedClients.updateClientUser(
      user.organizationId,
      user.sub,
      id,
      membershipId,
      dto,
    );
  }

  @Patch(':id/users/:membershipId/status')
  updateUserStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('membershipId') membershipId: string,
    @Body() dto: UpdateClientUserStatusDto,
  ) {
    return this.servedClients.updateClientUserStatus(
      user.organizationId,
      user.sub,
      id,
      membershipId,
      dto.isActive,
    );
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
