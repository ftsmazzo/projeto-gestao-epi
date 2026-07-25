import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { plainToInstance } from 'class-transformer';
import { validateOrReject } from 'class-validator';
import type { Request, Response } from 'express';
import { createReadStream } from 'fs';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../auth/current-user.decorator';
import { ClientJwtAuthGuard } from '../auth/jwt-auth.guard';
import type { ClientJwtPayload } from '../auth/types/jwt-payload';
import { PortalCreateDeliveryPayloadDto } from './dto/portal-delivery.dto';
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

  @Get('entregas/preparacao')
  entregasPreparacao(@CurrentUser() user: ClientJwtPayload) {
    this.assertClient(user);
    return this.portal.getEntregasPreparacao(
      user.organizationId,
      user.servedClientId,
    );
  }

  @Get('entregas')
  listEntregas(@CurrentUser() user: ClientJwtPayload) {
    this.assertClient(user);
    return this.portal.listDeliveries(
      user.organizationId,
      user.servedClientId,
    );
  }

  @Get('entregas/:id')
  getEntrega(@CurrentUser() user: ClientJwtPayload, @Param('id') id: string) {
    this.assertClient(user);
    return this.portal.getDelivery(
      user.organizationId,
      user.servedClientId,
      id,
    );
  }

  @Get('entregas/:id/evidence/facial')
  async getEntregaFacial(
    @CurrentUser() user: ClientJwtPayload,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    this.assertClient(user);
    const file = await this.portal.getFacialEvidenceAbsolutePath(
      user.organizationId,
      user.servedClientId,
      id,
    );
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Cache-Control', 'private, no-store');
    createReadStream(file.absolutePath).pipe(res);
  }

  @Post('entregas')
  @UseInterceptors(
    FileInterceptor('facial', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async createEntrega(
    @CurrentUser() user: ClientJwtPayload,
    @UploadedFile() facial: Express.Multer.File | undefined,
    @Body('payload') payloadRaw?: string,
    @Req() req?: Request,
  ) {
    this.assertClient(user);

    if (!facial?.buffer?.length) {
      throw new BadRequestException(
        'Evidencia facial obrigatoria. Envie a captura no campo multipart "facial".',
      );
    }

    if (!payloadRaw?.trim()) {
      throw new BadRequestException(
        'Payload da entrega obrigatorio (campo multipart "payload" em JSON).',
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(payloadRaw) as unknown;
    } catch {
      throw new BadRequestException('Payload JSON invalido.');
    }

    const dto = plainToInstance(PortalCreateDeliveryPayloadDto, parsed);
    try {
      await validateOrReject(dto, {
        whitelist: true,
        forbidNonWhitelisted: true,
      });
    } catch (errors) {
      const messages = Array.isArray(errors)
        ? errors
            .flatMap((e: { constraints?: Record<string, string> }) =>
              e.constraints ? Object.values(e.constraints) : [],
            )
            .filter(Boolean)
        : ['Payload invalido'];
      throw new BadRequestException(
        messages.length > 0 ? messages : 'Payload invalido',
      );
    }

    const forwarded = req?.headers?.['x-forwarded-for'];
    const forwardedIp = Array.isArray(forwarded)
      ? forwarded[0]
      : typeof forwarded === 'string'
        ? forwarded.split(',')[0]?.trim()
        : undefined;

    return this.portal.createDelivery(
      user.organizationId,
      user.servedClientId,
      user.sub,
      dto,
      {
        buffer: facial.buffer,
        mimeType: facial.mimetype,
        originalName: facial.originalname,
      },
      {
        operatorIp: forwardedIp || req?.ip || null,
        userAgent:
          typeof req?.headers?.['user-agent'] === 'string'
            ? req.headers['user-agent']
            : null,
      },
    );
  }

  @Get('trabalhadores')
  trabalhadores(@CurrentUser() user: ClientJwtPayload) {
    this.assertClient(user);
    return this.portal.getTrabalhadores(
      user.organizationId,
      user.servedClientId,
    );
  }

  @Get('trabalhadores/:id/epi-coverage')
  trabalhadorEpiCoverage(
    @CurrentUser() user: ClientJwtPayload,
    @Param('id') id: string,
  ) {
    this.assertClient(user);
    return this.portal.getWorkerEpiCoverage(
      user.organizationId,
      user.servedClientId,
      id,
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
