import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/types/jwt-payload';
import { HardResetDto } from './dto/hard-reset.dto';
import {
  CreateOrganizationContactDto,
  UpdateOrganizationContactDto,
} from './dto/organization-contact.dto';
import {
  CreateOrganizationMemberDto,
  TransferOrganizationOwnershipDto,
  UpdateOrganizationMemberDto,
  UpdateOrganizationMemberRoleDto,
} from './dto/organization-member.dto';
import { OrganizationService } from './organization.service';

@Controller('organization')
@UseGuards(JwtAuthGuard)
export class OrganizationController {
  constructor(private readonly organization: OrganizationService) {}

  @Get('members')
  listMembers(@CurrentUser() user: JwtPayload) {
    return this.organization.listMembers(user.organizationId);
  }

  @Post('members')
  createMember(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateOrganizationMemberDto,
  ) {
    return this.organization.createMember(
      user.organizationId,
      user.sub,
      user.membershipRole,
      dto,
    );
  }

  @Patch('members/:id/role')
  updateMemberRole(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationMemberRoleDto,
  ) {
    return this.organization.updateMemberRole(
      user.organizationId,
      user.sub,
      user.membershipRole,
      id,
      dto,
    );
  }

  @Patch('members/:id')
  updateMember(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationMemberDto,
  ) {
    return this.organization.updateMember(
      user.organizationId,
      user.sub,
      user.membershipRole,
      id,
      dto,
    );
  }

  @Post('members/transfer-ownership')
  transferOwnership(
    @CurrentUser() user: JwtPayload,
    @Body() dto: TransferOrganizationOwnershipDto,
  ) {
    return this.organization.transferOwnership(
      user.organizationId,
      user.sub,
      user.membershipRole,
      dto.membershipId,
    );
  }

  @Post('members/:id/reset-password')
  resetMemberPassword(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.organization.resetMemberPassword(
      user.organizationId,
      user.sub,
      user.membershipRole,
      id,
    );
  }

  @Delete('members/:id')
  removeMember(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.organization.removeMember(
      user.organizationId,
      user.sub,
      user.membershipRole,
      id,
    );
  }

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

  @Get('branding')
  branding(@CurrentUser() user: JwtPayload) {
    return this.organization.getBranding(user.organizationId);
  }

  @Get('logo')
  logo(@CurrentUser() user: JwtPayload, @Res() res: Response) {
    return this.organization.streamLogo(user.organizationId, res);
  }

  @Post('logo')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  uploadLogo(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    return this.organization.uploadLogo(
      user.organizationId,
      user.sub,
      user.membershipRole,
      file,
    );
  }

  @Delete('logo')
  deleteLogo(@CurrentUser() user: JwtPayload) {
    return this.organization.deleteLogo(
      user.organizationId,
      user.sub,
      user.membershipRole,
    );
  }
}
