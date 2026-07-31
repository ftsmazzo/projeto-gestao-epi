import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/types/jwt-payload';
import { HardResetDto } from './dto/hard-reset.dto';
import {
  CreateOrganizationContactDto,
  UpdateOrganizationContactDto,
} from './dto/organization-contact.dto';
import { OrganizationService } from './organization.service';

@Controller('organization')
@UseGuards(JwtAuthGuard)
export class OrganizationController {
  constructor(private readonly organization: OrganizationService) {}

  @Get('contacts')
  listContacts(@CurrentUser() user: JwtPayload) {
    return this.organization.listContacts(user.organizationId);
  }

  @Post('contacts')
  createContact(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateOrganizationContactDto,
  ) {
    return this.organization.createContact(
      user.organizationId,
      user.sub,
      dto,
    );
  }

  @Patch('contacts/:id')
  updateContact(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationContactDto,
  ) {
    return this.organization.updateContact(
      user.organizationId,
      user.sub,
      id,
      dto,
    );
  }

  @Delete('contacts/:id')
  deleteContact(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.organization.deleteContact(
      user.organizationId,
      user.sub,
      id,
    );
  }

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
