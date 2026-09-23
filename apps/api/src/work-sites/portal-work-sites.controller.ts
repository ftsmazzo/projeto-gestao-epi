import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Put,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { CurrentUser } from '../auth/current-user.decorator';
import { ClientJwtAuthGuard } from '../auth/jwt-auth.guard';
import type { ClientJwtPayload } from '../auth/types/jwt-payload';
import { WorkSitesService } from './work-sites.service';

class UpsertWorkSiteDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(18)
  cnpj?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  addressLine?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  state?: string | null;

  @IsOptional()
  @IsString()
  plannedStartAt?: string | null;

  @IsOptional()
  @IsString()
  plannedEndAt?: string | null;
}

class AssignWorkerDto {
  @IsString()
  workerId!: string;

  @IsString()
  workSiteId!: string;

  @IsOptional()
  @IsString()
  startAt?: string;
}

class ImportCsvDto {
  @IsOptional()
  @IsString()
  csvText?: string;

  @IsOptional()
  @IsString()
  csvBase64?: string;
}

@Controller('portal/obras')
@UseGuards(ClientJwtAuthGuard)
export class PortalWorkSitesController {
  constructor(private readonly workSites: WorkSitesService) {}

  @Get()
  list(@CurrentUser() user: ClientJwtPayload) {
    this.assertClient(user);
    return this.workSites.list(user.organizationId, user.servedClientId);
  }

  @Get('ending-soon')
  endingSoon(@CurrentUser() user: ClientJwtPayload) {
    this.assertClient(user);
    return this.workSites.listEndingSoon(
      user.organizationId,
      user.servedClientId,
    );
  }

  @Get('import/template')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  template(@CurrentUser() user: ClientJwtPayload, @Res() res: Response) {
    this.assertClient(user);
    const csv = this.workSites.importTemplateCsv();
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="modelo-obras.csv"',
    );
    res.send(csv);
  }

  @Get('trabalhadores/:workerId/assignments')
  workerAssignments(
    @CurrentUser() user: ClientJwtPayload,
    @Param('workerId') workerId: string,
  ) {
    this.assertClient(user);
    return this.workSites.listWorkerAssignments(
      user.organizationId,
      user.servedClientId,
      workerId,
    );
  }

  @Post('import/preview')
  previewImport(
    @CurrentUser() user: ClientJwtPayload,
    @Body() body: ImportCsvDto,
  ) {
    this.assertClient(user);
    return this.workSites.previewImport(
      user.organizationId,
      user.servedClientId,
      body,
    );
  }

  @Post('import/confirm')
  confirmImport(
    @CurrentUser() user: ClientJwtPayload,
    @Body() body: ImportCsvDto,
  ) {
    this.assertClient(user);
    return this.workSites.confirmImport(
      user.organizationId,
      user.servedClientId,
      user.sub,
      body,
    );
  }

  @Post('assignments')
  assign(@CurrentUser() user: ClientJwtPayload, @Body() body: AssignWorkerDto) {
    this.assertClient(user);
    return this.workSites.assignWorker(
      user.organizationId,
      user.servedClientId,
      user.sub,
      body,
    );
  }

  @Post()
  create(@CurrentUser() user: ClientJwtPayload, @Body() body: UpsertWorkSiteDto) {
    this.assertClient(user);
    return this.workSites.create(
      user.organizationId,
      user.servedClientId,
      user.sub,
      body,
    );
  }

  @Put(':id')
  update(
    @CurrentUser() user: ClientJwtPayload,
    @Param('id') id: string,
    @Body() body: UpsertWorkSiteDto,
  ) {
    this.assertClient(user);
    return this.workSites.update(
      user.organizationId,
      user.servedClientId,
      user.sub,
      id,
      body,
    );
  }

  @Post(':id/finalizar')
  finish(@CurrentUser() user: ClientJwtPayload, @Param('id') id: string) {
    this.assertClient(user);
    return this.workSites.finish(
      user.organizationId,
      user.servedClientId,
      user.sub,
      id,
    );
  }

  private assertClient(user: ClientJwtPayload) {
    if (!user.servedClientId) {
      throw new Error('Sessao de portal sem cliente.');
    }
  }
}
