import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/types/jwt-payload';
import { HardResetDto } from './dto/hard-reset.dto';
import { OrganizationService } from './organization.service';

@Controller('organization')
@UseGuards(JwtAuthGuard)
export class OrganizationController {
  constructor(private readonly organization: OrganizationService) {}

  @Post('hard-reset')
  hardReset(@CurrentUser() user: JwtPayload, @Body() dto: HardResetDto) {
    return this.organization.hardResetOperationalData(
      user.organizationId,
      user.sub,
      user.membershipRole,
      dto.confirmation,
    );
  }
}
