import {
  Controller,
  Get,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { ClientJwtAuthGuard } from '../auth/jwt-auth.guard';
import type { ClientJwtPayload } from '../auth/types/jwt-payload';
import { PortalService } from './portal.service';

@Controller('portal')
@UseGuards(ClientJwtAuthGuard)
export class PortalController {
  constructor(private readonly portal: PortalService) {}

  @Get('dashboard')
  dashboard(@CurrentUser() user: ClientJwtPayload) {
    this.assertClient(user);
    return this.portal.getDashboard(user.organizationId, user.servedClientId);
  }

  @Get('validade')
  validade(@CurrentUser() user: ClientJwtPayload) {
    this.assertClient(user);
    return this.portal.getValidade(user.organizationId, user.servedClientId);
  }

  @Get('estrutura')
  estrutura(@CurrentUser() user: ClientJwtPayload) {
    this.assertClient(user);
    return this.portal.getEstrutura(user.organizationId, user.servedClientId);
  }

  @Get('trabalhadores')
  trabalhadores(@CurrentUser() user: ClientJwtPayload) {
    this.assertClient(user);
    return this.portal.getTrabalhadores(
      user.organizationId,
      user.servedClientId,
    );
  }

  @Get('estoque')
  estoque(@CurrentUser() user: ClientJwtPayload) {
    this.assertClient(user);
    return this.portal.getEstoqueResumo(
      user.organizationId,
      user.servedClientId,
    );
  }

  private assertClient(user: ClientJwtPayload) {
    if (!user.servedClientId) {
      throw new NotFoundException('Cliente do portal nao identificado.');
    }
  }
}
