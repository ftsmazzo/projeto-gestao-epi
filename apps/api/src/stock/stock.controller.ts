import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { EpiStockMovementType } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/types/jwt-payload';
import {
  CreateStockLocationDto,
  CreateStockMovementDto,
  UpdateStockLocationDto,
  UpdateStockLocationStatusDto,
} from './dto/stock.dto';
import { StockService } from './stock.service';

@Controller('stock')
@UseGuards(JwtAuthGuard)
export class StockController {
  constructor(private readonly stock: StockService) {}

  @Get('locations')
  listLocations(@CurrentUser() user: JwtPayload) {
    return this.stock.listLocations(user.organizationId);
  }

  @Post('locations')
  createLocation(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateStockLocationDto,
  ) {
    return this.stock.createLocation(user.organizationId, user.sub, dto);
  }

  @Patch('locations/:id')
  updateLocation(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateStockLocationDto,
  ) {
    return this.stock.updateLocation(user.organizationId, user.sub, id, dto);
  }

  @Patch('locations/:id/status')
  updateLocationStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateStockLocationStatusDto,
  ) {
    return this.stock.updateLocationStatus(
      user.organizationId,
      user.sub,
      id,
      dto.isActive,
    );
  }

  @Get('summary')
  getSummary(@CurrentUser() user: JwtPayload) {
    return this.stock.getSummary(user.organizationId);
  }

  @Get('balances')
  listBalances(
    @CurrentUser() user: JwtPayload,
    @Query('epiItemId') epiItemId?: string,
    @Query('stockLocationId') stockLocationId?: string,
    @Query('category') category?: string,
    @Query('lowOnly') lowOnly?: string,
  ) {
    return this.stock.listBalances(user.organizationId, {
      epiItemId,
      stockLocationId,
      category,
      lowOnly: lowOnly === '1' || lowOnly === 'true',
    });
  }

  @Get('totals-by-epi')
  listTotalsByEpi(@CurrentUser() user: JwtPayload) {
    return this.stock.listTotalsByEpi(user.organizationId);
  }

  @Get('movements')
  listMovements(
    @CurrentUser() user: JwtPayload,
    @Query('epiItemId') epiItemId?: string,
    @Query('stockLocationId') stockLocationId?: string,
    @Query('type') type?: EpiStockMovementType,
    @Query('limit') limit?: string,
  ) {
    return this.stock.listMovements(user.organizationId, {
      epiItemId,
      stockLocationId,
      type,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post('movements')
  createMovement(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateStockMovementDto,
  ) {
    return this.stock.createMovement(user.organizationId, user.sub, dto);
  }
}
