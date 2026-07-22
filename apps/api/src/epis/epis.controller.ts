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
import { UpdateEpiItemDto } from './dto/update-epi-item.dto';
import { UpdateEpiItemStatusDto } from './dto/update-epi-item-status.dto';
import { EpisService } from './epis.service';

@Controller('epis')
@UseGuards(JwtAuthGuard)
export class EpisController {
  constructor(private readonly epis: EpisService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.epis.list(user.organizationId);
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
      dto.status,
    );
  }
}
