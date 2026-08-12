import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { PlatformJwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/types/jwt-payload';
import { CreatePlatformTenantDto } from './dto/create-tenant.dto';
import { DestroyPlatformTenantDto } from './dto/destroy-tenant.dto';
import { GrantPlatformLivesDto } from './dto/grant-lives.dto';
import { SuspendPlatformTenantDto } from './dto/suspend-tenant.dto';
import { UpdatePlatformTenantDto } from './dto/update-tenant.dto';
import { PlatformService } from './platform.service';

@Controller('platform')
@UseGuards(PlatformJwtAuthGuard)
export class PlatformController {
  constructor(private readonly platform: PlatformService) {}

  @Get('tenants')
  overview() {
    return this.platform.overview();
  }

  @Post('tenants')
  create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreatePlatformTenantDto,
  ) {
    return this.platform.createTenant(user.sub, dto);
  }

  @Patch('tenants/:id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdatePlatformTenantDto,
  ) {
    return this.platform.updateTenant(user.sub, id, dto);
  }

  @Post('tenants/:id/lives')
  grantLives(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: GrantPlatformLivesDto,
  ) {
    return this.platform.grantLives(user.sub, id, dto);
  }

  @Post('tenants/:id/resend-access')
  resendAccess(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.platform.resendAccess(user.sub, id);
  }

  @Post('tenants/:id/suspend')
  suspend(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: SuspendPlatformTenantDto,
  ) {
    return this.platform.suspendTenant(user.sub, id, dto);
  }

  @Post('tenants/:id/activate')
  activate(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.platform.activateTenant(user.sub, id);
  }

  @Delete('tenants/:id')
  destroy(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: DestroyPlatformTenantDto,
  ) {
    return this.platform.destroyTenant(user.sub, id, dto);
  }
}
