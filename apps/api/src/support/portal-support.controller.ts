import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { ClientJwtAuthGuard } from '../auth/jwt-auth.guard';
import type { ClientJwtPayload } from '../auth/types/jwt-payload';
import {
  SupportEscalateDto,
  SupportLoadThreadQueryDto,
  SupportSendMessageDto,
} from './dto/support.dto';
import { SupportService } from './support.service';

@Controller('portal/support')
@UseGuards(ClientJwtAuthGuard)
export class PortalSupportController {
  constructor(private readonly support: SupportService) {}

  @Get('thread')
  loadThread(@CurrentUser() user: ClientJwtPayload) {
    return this.support.loadThread(
      {
        audience: 'portal',
        organizationId: user.organizationId,
        userId: user.sub,
        clientRole: user.clientRole,
        servedClientId: user.servedClientId,
      },
      'CLIENTE',
      user.servedClientId,
    );
  }

  @Post('message')
  send(@CurrentUser() user: ClientJwtPayload, @Body() dto: SupportSendMessageDto) {
    return this.support.sendMessage(
      {
        audience: 'portal',
        organizationId: user.organizationId,
        userId: user.sub,
        clientRole: user.clientRole,
        servedClientId: user.servedClientId,
      },
      { scope: 'CLIENTE', body: dto.body, servedClientId: user.servedClientId },
    );
  }

  @Post('escalate')
  escalate(@CurrentUser() user: ClientJwtPayload, @Body() dto: SupportEscalateDto) {
    return this.support.escalate(
      {
        audience: 'portal',
        organizationId: user.organizationId,
        userId: user.sub,
        clientRole: user.clientRole,
        servedClientId: user.servedClientId,
      },
      { scope: 'CLIENTE', servedClientId: user.servedClientId, reason: dto.reason },
    );
  }

  @Post('return-ai')
  returnToAi(
    @CurrentUser() user: ClientJwtPayload,
    @Body() _dto: SupportLoadThreadQueryDto,
  ) {
    return this.support.returnToAi(
      {
        audience: 'portal',
        organizationId: user.organizationId,
        userId: user.sub,
        clientRole: user.clientRole,
        servedClientId: user.servedClientId,
      },
      'CLIENTE',
      user.servedClientId,
    );
  }
}
