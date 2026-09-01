import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { SstDocumentStatus, WorkerStatus } from '@prisma/client';
import type { McpApiContext } from './mcp-api-key.guard';
import { McpApiKeyGuard } from './mcp-api-key.guard';
import { McpApiService } from './mcp-api.service';

type McpRequest = Request & { mcp: McpApiContext };

@Controller('mcp/v1')
@UseGuards(McpApiKeyGuard)
export class McpApiController {
  constructor(private readonly mcp: McpApiService) {}

  private org(req: McpRequest) {
    return req.mcp.organizationId;
  }

  @Get('context')
  context(@Req() req: McpRequest) {
    return this.mcp.getContext(this.org(req));
  }

  @Get('clients')
  listClients(@Req() req: McpRequest) {
    return this.mcp.listClients(this.org(req));
  }

  @Get('clients/:id')
  getClient(@Req() req: McpRequest, @Param('id') id: string) {
    return this.mcp.getClient(this.org(req), id);
  }

  @Get('clients/:id/overview')
  clientOverview(@Req() req: McpRequest, @Param('id') id: string) {
    return this.mcp.getClientOverview(this.org(req), id);
  }

  @Get('clients/:id/workers')
  clientWorkers(
    @Req() req: McpRequest,
    @Param('id') id: string,
    @Query('status') status?: WorkerStatus,
    @Query('limit') limit?: string,
  ) {
    return this.mcp.listWorkers(this.org(req), id, {
      status,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('clients/:id/structure')
  clientStructure(@Req() req: McpRequest, @Param('id') id: string) {
    return this.mcp.getClientStructure(this.org(req), id);
  }

  @Get('clients/:id/stock-summary')
  clientStock(
    @Req() req: McpRequest,
    @Param('id') id: string,
  ) {
    return this.mcp.getStockSummary(this.org(req), id);
  }

  @Get('search')
  search(
    @Req() req: McpRequest,
    @Query('q') q: string,
    @Query('limit') limit?: string,
  ) {
    return this.mcp.search(
      this.org(req),
      q ?? '',
      limit ? Number(limit) : undefined,
    );
  }

  @Get('epi/catalog')
  epiCatalog(@Req() req: McpRequest) {
    return this.mcp.listEpiCatalog(this.org(req));
  }

  @Get('epi/needs')
  epiNeeds(@Req() req: McpRequest) {
    return this.mcp.listEpiNeeds(this.org(req));
  }

  @Get('caepi/:caNumber')
  caepi(@Param('caNumber') caNumber: string) {
    return this.mcp.findCaepi(caNumber);
  }

  @Get('training/issuances')
  trainingIssuances(
    @Req() req: McpRequest,
    @Query('clientId') clientId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.mcp.listTrainingIssuances(
      this.org(req),
      clientId,
      limit ? Number(limit) : undefined,
    );
  }

  @Get('sst/documents')
  sstDocuments(
    @Req() req: McpRequest,
    @Query('clientId') clientId?: string,
    @Query('status') status?: SstDocumentStatus,
    @Query('limit') limit?: string,
  ) {
    return this.mcp.listSstDocuments(
      this.org(req),
      clientId,
      status,
      limit ? Number(limit) : undefined,
    );
  }

  @Get('groups')
  groups(@Req() req: McpRequest) {
    return this.mcp.listClientGroups(this.org(req));
  }

  @Get('stock/summary')
  stockSummary(@Req() req: McpRequest) {
    return this.mcp.getStockSummary(this.org(req));
  }
}
