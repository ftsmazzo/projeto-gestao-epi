import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/types/jwt-payload';
import {
  CreateClientJobFunctionDto,
  CreateClientSectorDto,
  CreateJobFunctionEpiRequirementDto,
  CreateOccupationalRiskDto,
  LinkJobFunctionRiskDto,
  UpdateClientJobFunctionDto,
  UpdateClientSectorDto,
  UpdateJobFunctionEpiRequirementDto,
  UpdateOccupationalRiskDto,
  UpdateStatusDto,
} from './dto/client-structure.dto';
import { ClientStructureService } from './client-structure.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class ClientStructureController {
  constructor(private readonly structure: ClientStructureService) {}

  @Get('client-sectors')
  listSectors(
    @CurrentUser() user: JwtPayload,
    @Query('servedClientId') servedClientId: string,
    @Query('status') status?: 'all' | 'active' | 'inactive',
  ) {
    return this.structure.listSectors(
      user.organizationId,
      servedClientId,
      status ?? 'all',
    );
  }

  @Post('client-sectors')
  createSector(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateClientSectorDto,
  ) {
    return this.structure.createSector(user.organizationId, user.sub, dto);
  }

  @Patch('client-sectors/:id')
  updateSector(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateClientSectorDto,
  ) {
    return this.structure.updateSector(
      user.organizationId,
      user.sub,
      id,
      dto,
    );
  }

  @Patch('client-sectors/:id/status')
  updateSectorStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.structure.updateSectorStatus(
      user.organizationId,
      user.sub,
      id,
      dto.isActive,
    );
  }

  @Get('client-job-functions')
  listJobs(
    @CurrentUser() user: JwtPayload,
    @Query('servedClientId') servedClientId: string,
    @Query('sectorId') sectorId?: string,
    @Query('status') status?: 'all' | 'active' | 'inactive',
  ) {
    return this.structure.listJobFunctions(user.organizationId, {
      servedClientId,
      sectorId,
      status,
    });
  }

  @Get('client-job-functions/:id')
  getJob(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.structure.getJobFunction(user.organizationId, id);
  }

  @Post('client-job-functions')
  createJob(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateClientJobFunctionDto,
  ) {
    return this.structure.createJobFunction(
      user.organizationId,
      user.sub,
      dto,
    );
  }

  @Patch('client-job-functions/:id')
  updateJob(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateClientJobFunctionDto,
  ) {
    return this.structure.updateJobFunction(
      user.organizationId,
      user.sub,
      id,
      dto,
    );
  }

  @Patch('client-job-functions/:id/status')
  updateJobStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.structure.updateJobFunctionStatus(
      user.organizationId,
      user.sub,
      id,
      dto.isActive,
    );
  }

  @Post('client-job-functions/:id/risks')
  linkRisk(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: LinkJobFunctionRiskDto,
  ) {
    return this.structure.linkRisk(user.organizationId, user.sub, id, dto);
  }

  @Delete('client-job-functions/:id/risks/:riskId')
  unlinkRisk(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('riskId') riskId: string,
  ) {
    return this.structure.unlinkRisk(
      user.organizationId,
      user.sub,
      id,
      riskId,
    );
  }

  @Get('client-job-functions/:id/epi-requirements')
  listEpiRequirements(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.structure.listEpiRequirements(user.organizationId, id);
  }

  @Post('client-job-functions/:id/epi-requirements')
  createEpiRequirement(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CreateJobFunctionEpiRequirementDto,
  ) {
    return this.structure.createEpiRequirement(
      user.organizationId,
      user.sub,
      id,
      dto,
    );
  }

  @Patch('client-job-functions/:id/epi-requirements/:requirementId')
  updateEpiRequirement(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('requirementId') requirementId: string,
    @Body() dto: UpdateJobFunctionEpiRequirementDto,
  ) {
    return this.structure.updateEpiRequirement(
      user.organizationId,
      user.sub,
      id,
      requirementId,
      dto,
    );
  }

  @Patch('client-job-functions/:id/epi-requirements/:requirementId/status')
  updateEpiRequirementStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('requirementId') requirementId: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.structure.updateEpiRequirementStatus(
      user.organizationId,
      user.sub,
      id,
      requirementId,
      dto.isActive,
    );
  }

  @Delete('client-job-functions/:id/epi-requirements/:requirementId')
  deleteEpiRequirement(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('requirementId') requirementId: string,
  ) {
    return this.structure.deleteEpiRequirement(
      user.organizationId,
      user.sub,
      id,
      requirementId,
    );
  }

  @Get('occupational-risks')
  listRisks(
    @CurrentUser() user: JwtPayload,
    @Query('q') q?: string,
    @Query('category') category?: string,
    @Query('status') status?: 'all' | 'active' | 'inactive',
  ) {
    return this.structure.listRisks(user.organizationId, {
      q,
      category,
      status,
    });
  }

  @Post('occupational-risks')
  createRisk(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateOccupationalRiskDto,
  ) {
    return this.structure.createRisk(user.organizationId, user.sub, dto);
  }

  @Post('occupational-risks/suggest-defaults')
  suggestRisks(@CurrentUser() user: JwtPayload) {
    return this.structure.suggestDefaultRisks(user.organizationId, user.sub);
  }

  @Patch('occupational-risks/:id')
  updateRisk(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateOccupationalRiskDto,
  ) {
    return this.structure.updateRisk(user.organizationId, user.sub, id, dto);
  }

  @Patch('occupational-risks/:id/status')
  updateRiskStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.structure.updateRiskStatus(
      user.organizationId,
      user.sub,
      id,
      dto.isActive,
    );
  }
}
