import {
  Body,
  Controller,
  ForbiddenException,
  NotFoundException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { MembershipRole } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/types/jwt-payload';
import { CommunicationAlertsService } from './communication-alerts.service';
import { CommunicationsService } from './communications.service';
import { RunDailyAlertsDto } from './dto/run-daily-alerts.dto';

@Controller('communications')
@UseGuards(JwtAuthGuard)
export class CommunicationsController {
  constructor(
    private readonly alerts: CommunicationAlertsService,
    private readonly communications: CommunicationsService,
  ) {}

  @Post('alerts/daily/run')
  async runDailyAlerts(
    @CurrentUser() user: JwtPayload,
    @Body() dto: RunDailyAlertsDto,
  ) {
    this.assertManagementRole(user.membershipRole);

    if (!this.communications.isEnabled()) {
      return {
        clients: 0,
        messages: 0,
        skippedReason: 'communications_disabled' as const,
      };
    }
    if (!this.communications.isAlertsEnabled()) {
      return {
        clients: 0,
        messages: 0,
        skippedReason: 'alerts_disabled' as const,
      };
    }

    const result = await this.alerts.runDailyClientAlerts({
      organizationId: user.organizationId,
      servedClientId: dto.servedClientId?.trim() || undefined,
    });

    if (
      dto.servedClientId?.trim() &&
      result.skippedReason === 'client_not_found'
    ) {
      throw new NotFoundException('Cliente atendido nao encontrado.');
    }

    return result;
  }

  private assertManagementRole(membershipRole: string) {
    if (
      membershipRole !== MembershipRole.OWNER &&
      membershipRole !== MembershipRole.ADMIN
    ) {
      throw new ForbiddenException(
        'Apenas OWNER ou ADMIN podem disparar alertas manuais.',
      );
    }
  }
}
