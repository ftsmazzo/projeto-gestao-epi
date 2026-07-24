import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { ClientJwtAuthGuard } from '../auth/jwt-auth.guard';
import type { ClientJwtPayload } from '../auth/types/jwt-payload';
import { PortalStockEntradasDto } from './dto/portal-stock.dto';
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

  @Get('epis/search')
  searchEpis(
    @CurrentUser() user: ClientJwtPayload,
    @Query('q') q = '',
  ) {
    this.assertClient(user);
    return this.portal.searchEpis(user.organizationId, q);
  }

  @Get('epis/by-ca')
  lookupEpiByCa(
    @CurrentUser() user: ClientJwtPayload,
    @Query('ca') ca = '',
  ) {
    this.assertClient(user);
    return this.portal.lookupEpiByCa(user.organizationId, ca);
  }

  /** Mesma busca CAEPI do catalogo mestre da Consultoria, no JWT do cliente. */
  @Get('caepi/search')
  searchCaepi(
    @CurrentUser() user: ClientJwtPayload,
    @Query('q') q = '',
    @Query('limit') limitRaw?: string,
  ) {
    this.assertClient(user);
    const limit = limitRaw ? Number(limitRaw) : 12;
    return this.portal.searchCaepiBase(q, limit);
  }

  @Get('stock/locations')
  stockLocations(@CurrentUser() user: ClientJwtPayload) {
    this.assertClient(user);
    return this.portal.listStockLocations(
      user.organizationId,
      user.servedClientId,
    );
  }

  @Get('stock/balances')
  stockBalances(@CurrentUser() user: ClientJwtPayload) {
    this.assertClient(user);
    return this.portal.listClientBalances(
      user.organizationId,
      user.servedClientId,
    );
  }

  @Post('stock/entradas')
  stockEntradas(
    @CurrentUser() user: ClientJwtPayload,
    @Body() dto: PortalStockEntradasDto,
  ) {
    this.assertClient(user);
    return this.portal.createEntradas(
      user.organizationId,
      user.servedClientId,
      user.sub,
      dto,
    );
  }

  private assertClient(user: ClientJwtPayload) {
    if (!user.servedClientId) {
      throw new NotFoundException('Cliente do portal nao identificado.');
    }
  }
}
