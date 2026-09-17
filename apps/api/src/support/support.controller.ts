import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/types/jwt-payload';
import {
  SupportEscalateDto,
  SupportLoadThreadQueryDto,
  SupportSendMessageDto,
} from './dto/support.dto';
import { SupportService } from './support.service';

@Controller('support')
@UseGuards(JwtAuthGuard)
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Get('thread')
  loadThread(
    @CurrentUser() user: JwtPayload,
    @Query() query: SupportLoadThreadQueryDto,
  ) {
    return this.support.loadThread(
      {
        audience: 'consultoria',
        organizationId: user.organizationId,
        userId: user.sub,
        membershipRole: user.membershipRole,
      },
      query.scope ?? 'CONSULTORIA',
      query.servedClientId,
      query.currentPath,
    );
  }

  @Post('message')
  send(@CurrentUser() user: JwtPayload, @Body() dto: SupportSendMessageDto) {
    return this.support.sendMessage(
      {
        audience: 'consultoria',
        organizationId: user.organizationId,
        userId: user.sub,
        membershipRole: user.membershipRole,
      },
      {
        scope: dto.scope ?? 'CONSULTORIA',
        servedClientId: dto.servedClientId,
        currentPath: dto.currentPath,
        body: dto.body,
      },
    );
  }

  @Post('escalate')
  escalate(@CurrentUser() user: JwtPayload, @Body() dto: SupportEscalateDto) {
    return this.support.escalate(
      {
        audience: 'consultoria',
        organizationId: user.organizationId,
        userId: user.sub,
        membershipRole: user.membershipRole,
      },
      {
        scope: dto.scope ?? 'CONSULTORIA',
        servedClientId: dto.servedClientId,
        currentPath: dto.currentPath,
        reason: dto.reason,
      },
    );
  }

}
