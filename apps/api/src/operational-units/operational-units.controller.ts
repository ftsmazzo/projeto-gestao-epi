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
import { CreateOperationalUnitDto } from './dto/create-operational-unit.dto';
import { UpdateOperationalUnitDto } from './dto/update-operational-unit.dto';
import { UpdateOperationalUnitStatusDto } from './dto/update-operational-unit-status.dto';
import { OperationalUnitsService } from './operational-units.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class OperationalUnitsController {
  constructor(private readonly operationalUnits: OperationalUnitsService) {}

  @Get('served-clients/:servedClientId/operational-units')
  listByServedClient(
    @CurrentUser() user: JwtPayload,
    @Param('servedClientId') servedClientId: string,
  ) {
    return this.operationalUnits.listByServedClient(
      user.organizationId,
      servedClientId,
    );
  }

  @Post('served-clients/:servedClientId/operational-units')
  create(
    @CurrentUser() user: JwtPayload,
    @Param('servedClientId') servedClientId: string,
    @Body() dto: CreateOperationalUnitDto,
  ) {
    return this.operationalUnits.create(
      user.organizationId,
      user.sub,
      servedClientId,
      dto,
    );
  }

  @Get('operational-units/:id')
  getById(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.operationalUnits.getById(user.organizationId, id);
  }

  @Patch('operational-units/:id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateOperationalUnitDto,
  ) {
    return this.operationalUnits.update(
      user.organizationId,
      user.sub,
      id,
      dto,
    );
  }

  @Patch('operational-units/:id/status')
  updateStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateOperationalUnitStatusDto,
  ) {
    return this.operationalUnits.updateStatus(
      user.organizationId,
      user.sub,
      id,
      dto.status,
    );
  }
}
