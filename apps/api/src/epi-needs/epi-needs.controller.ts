import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/types/jwt-payload';
import {
  CreateEpiNeedDto,
  LinkEpiNeedItemDto,
  MatchEpiNeedsDto,
  SyncEpiItemNeedsDto,
  UpdateEpiNeedDto,
  UpdateEpiNeedStatusDto,
} from './dto/epi-need.dto';
import { EpiNeedsService } from './epi-needs.service';

@Controller('epi-needs')
@UseGuards(JwtAuthGuard)
export class EpiNeedsController {
  constructor(private readonly epiNeeds: EpiNeedsService) {}

  @Get()
  list(
    @CurrentUser() user: JwtPayload,
    @Query('q') q?: string,
    @Query('category') category?: string,
    @Query('status') status?: 'active' | 'inactive' | 'all',
  ) {
    return this.epiNeeds.list(user.organizationId, { q, category, status });
  }

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateEpiNeedDto) {
    return this.epiNeeds.create(user.organizationId, user.sub, dto);
  }

  @Post('suggest-defaults')
  suggestDefaults(@CurrentUser() user: JwtPayload) {
    return this.epiNeeds.suggestDefaults(user.organizationId, user.sub);
  }

  @Post('match')
  match(@CurrentUser() user: JwtPayload, @Body() dto: MatchEpiNeedsDto) {
    return this.epiNeeds.matchSuggestions(user.organizationId, dto);
  }

  @Get('item/:epiItemId')
  listByItem(
    @CurrentUser() user: JwtPayload,
    @Param('epiItemId') epiItemId: string,
  ) {
    return this.epiNeeds.listNeedsByItem(user.organizationId, epiItemId);
  }

  @Put('item/:epiItemId')
  syncByItem(
    @CurrentUser() user: JwtPayload,
    @Param('epiItemId') epiItemId: string,
    @Body() dto: SyncEpiItemNeedsDto,
  ) {
    return this.epiNeeds.syncNeedsForItem(
      user.organizationId,
      user.sub,
      epiItemId,
      dto.needIds,
    );
  }

  @Get(':id')
  getById(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.epiNeeds.getById(user.organizationId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateEpiNeedDto,
  ) {
    return this.epiNeeds.update(user.organizationId, user.sub, id, dto);
  }

  @Patch(':id/status')
  updateStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateEpiNeedStatusDto,
  ) {
    return this.epiNeeds.updateStatus(
      user.organizationId,
      user.sub,
      id,
      dto.isActive,
    );
  }

  @Get(':id/items')
  listItems(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.epiNeeds.listItems(user.organizationId, id);
  }

  @Post(':id/items')
  linkItem(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: LinkEpiNeedItemDto,
  ) {
    return this.epiNeeds.linkItem(user.organizationId, user.sub, id, dto);
  }

  @Delete(':id/items/:epiItemId')
  unlinkItem(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('epiItemId') epiItemId: string,
  ) {
    return this.epiNeeds.unlinkItem(
      user.organizationId,
      user.sub,
      id,
      epiItemId,
    );
  }
}
