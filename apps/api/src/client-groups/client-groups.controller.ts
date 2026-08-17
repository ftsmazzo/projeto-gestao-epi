import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/types/jwt-payload';
import { ClientGroupsService } from './client-groups.service';
import {
  CreateClientGroupDto,
  GrantClientGroupAccessDto,
  SetClientGroupMembersDto,
  UpdateClientGroupDto,
} from './dto/client-group.dto';

@Controller('client-groups')
@UseGuards(JwtAuthGuard)
export class ClientGroupsController {
  constructor(private readonly groups: ClientGroupsService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.groups.list(user.organizationId);
  }

  @Get(':id')
  getById(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.groups.getById(user.organizationId, id);
  }

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateClientGroupDto) {
    return this.groups.create(user.organizationId, user.sub, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateClientGroupDto,
  ) {
    return this.groups.update(user.organizationId, user.sub, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.groups.remove(user.organizationId, user.sub, id);
  }

  @Put(':id/clients')
  setMembers(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: SetClientGroupMembersDto,
  ) {
    return this.groups.setMembers(user.organizationId, user.sub, id, dto);
  }

  @Post(':id/access')
  grantAccess(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: GrantClientGroupAccessDto,
  ) {
    return this.groups.grantAccess(user.organizationId, user.sub, id, dto);
  }
}
