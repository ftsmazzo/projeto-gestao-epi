import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { MembershipRole, OrganizationContactRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { createReadStream, existsSync } from 'fs';
import { rm } from 'fs/promises';
import { join } from 'path';
import type { Response } from 'express';
import { AuditService } from '../audit/audit.service';
import { CommunicationsService } from '../communications/communications.service';
import { getDeliveryEvidenceRoot } from '../portal/facial-evidence.storage';
import { PrismaService } from '../prisma/prisma.service';
import { getWorkerFaceReferenceRoot } from '../workers/worker-face-reference.storage';
import type {
  CreateOrganizationContactDto,
  UpdateOrganizationContactDto,
} from './dto/organization-contact.dto';
import type {
  CreateOrganizationMemberDto,
  UpdateOrganizationMemberRoleDto,
} from './dto/organization-member.dto';
import {
  deleteOrgLogoFile,
  resolveOrgLogoAbsolutePath,
  saveOrgLogoFile,
} from './org-logo.storage';

export type HardResetSummary = {
  servedClients: number;
  workers: number;
  epiItems: number;
  epiNeeds: number;
  stockLocations: number;
  occupationalRisks: number;
  pgroImportRuns: number;
  clientUsers: number;
  auditLogs: number;
  epiDeliveries: number;
  facialReferences: number;
};

@Injectable()
export class OrganizationService {
  private readonly logger = new Logger(OrganizationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly communications: CommunicationsService,
  ) {}

  async listContacts(organizationId: string) {
    return this.prisma.organizationContact.findMany({
      where: { organizationId },
      orderBy: [{ isPrimary: 'desc' }, { role: 'asc' }, { name: 'asc' }],
    });
  }

  async createContact(
    organizationId: string,
    userId: string,
    dto: CreateOrganizationContactDto,
  ) {
    const email = dto.email?.trim().toLowerCase() || null;
    const phone = dto.phone?.trim() || null;
    if (!email && !phone) {
      throw new BadRequestException(
        'Informe e-mail e/ou telefone (WhatsApp) para o contato.',
      );
    }

    const role = dto.role ?? OrganizationContactRole.SUPPORT;
    const isPrimary = dto.isPrimary === true;

    if (isPrimary) {
      await this.prisma.organizationContact.updateMany({
        where: { organizationId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const contact = await this.prisma.organizationContact.create({
      data: {
        organizationId,
        name: dto.name.trim(),
        email,
        phone,
        role,
        isPrimary,
        notes: dto.notes?.trim() || null,
      },
    });

    await this.audit.log({
      action: 'organization_contact.created',
      organizationId,
      userId,
      entityType: 'OrganizationContact',
      entityId: contact.id,
      metadata: { role: contact.role, isPrimary: contact.isPrimary },
    });

    return contact;
  }

  async updateContact(
    organizationId: string,
    userId: string,
    contactId: string,
    dto: UpdateOrganizationContactDto,
  ) {
    const existing = await this.prisma.organizationContact.findFirst({
      where: { id: contactId, organizationId },
    });
    if (!existing) {
      throw new NotFoundException('Contato da consultoria nao encontrado.');
    }

    const nextEmail =
      dto.email === undefined
        ? existing.email
        : dto.email?.trim().toLowerCase() || null;
    const nextPhone =
      dto.phone === undefined ? existing.phone : dto.phone?.trim() || null;
    if (!nextEmail && !nextPhone) {
      throw new BadRequestException(
        'O contato precisa ter e-mail e/ou telefone.',
      );
    }

    if (dto.isPrimary === true) {
      await this.prisma.organizationContact.updateMany({
        where: {
          organizationId,
          isPrimary: true,
          id: { not: contactId },
        },
        data: { isPrimary: false },
      });
    }

    const contact = await this.prisma.organizationContact.update({
      where: { id: contactId },
      data: {
        name: dto.name?.trim(),
        email: dto.email === undefined ? undefined : nextEmail,
        phone: dto.phone === undefined ? undefined : nextPhone,
        role: dto.role,
        isPrimary: dto.isPrimary,
        isActive: dto.isActive,
        notes:
          dto.notes === undefined ? undefined : dto.notes?.trim() || null,
      },
    });

    await this.audit.log({
      action: 'organization_contact.updated',
      organizationId,
      userId,
      entityType: 'OrganizationContact',
      entityId: contact.id,
      metadata: { role: contact.role, isPrimary: contact.isPrimary },
    });

    return contact;
  }

  async deleteContact(
    organizationId: string,
    userId: string,
    contactId: string,
  ) {
    const existing = await this.prisma.organizationContact.findFirst({
      where: { id: contactId, organizationId },
    });
    if (!existing) {
      throw new NotFoundException('Contato da consultoria nao encontrado.');
    }

    await this.prisma.organizationContact.delete({ where: { id: contactId } });

    await this.audit.log({
      action: 'organization_contact.deleted',
      organizationId,
      userId,
      entityType: 'OrganizationContact',
      entityId: contactId,
      metadata: { role: existing.role, name: existing.name },
    });

    return { ok: true as const };
  }

  async listMembers(organizationId: string) {
    const rows = await this.prisma.membership.findMany({
      where: { organizationId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    });

    return rows
      .map((row) => this.mapMember(row))
      .sort((a, b) => {
        const rank = (r: MembershipRole) =>
          r === MembershipRole.OWNER ? 0 : r === MembershipRole.ADMIN ? 1 : 2;
        return rank(a.role) - rank(b.role) || a.user.name.localeCompare(b.user.name);
      });
  }

  /**
   * Cria usuario da consultoria (ADMIN/MEMBER) ou vincula Membership a User existente.
   * OWNER so via transferOwnership.
   */
  async createMember(
    organizationId: string,
    actorUserId: string,
    actorRole: string,
    dto: CreateOrganizationMemberDto,
  ) {
    this.assertCanManageMembers(actorRole);

    const role = dto.role;
    if (role === MembershipRole.OWNER) {
      throw new BadRequestException(
        'Para definir o administrador geral, use a transferencia de OWNER.',
      );
    }
    if (role !== MembershipRole.ADMIN && role !== MembershipRole.MEMBER) {
      throw new BadRequestException('Papel invalido. Use ADMIN ou MEMBER.');
    }

    const email = dto.email.trim().toLowerCase();
    const name = dto.name.trim();
    if (!email || !name) {
      throw new BadRequestException('Informe nome e e-mail.');
    }

    const temporaryPassword = this.generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);

    const result = await this.prisma.$transaction(async (tx) => {
      let user = await tx.user.findUnique({ where: { email } });
      let createdUser = false;

      if (user) {
        const existingMembership = await tx.membership.findUnique({
          where: {
            userId_organizationId: {
              userId: user.id,
              organizationId,
            },
          },
        });
        if (existingMembership) {
          throw new BadRequestException(
            'Este e-mail ja possui acesso nesta consultoria.',
          );
        }
        // Atualiza nome se veio vazio/legado e redefine senha temporaria
        user = await tx.user.update({
          where: { id: user.id },
          data: {
            name: name || user.name,
            passwordHash,
            mustChangePassword: true,
          },
        });
      } else {
        user = await tx.user.create({
          data: {
            email,
            name,
            passwordHash,
            mustChangePassword: true,
          },
        });
        createdUser = true;
      }

      const membership = await tx.membership.create({
        data: {
          userId: user.id,
          organizationId,
          role,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      });

      return { membership, createdUser };
    });

    await this.audit.log({
      action: 'organization_member.created',
      organizationId,
      userId: actorUserId,
      entityType: 'Membership',
      entityId: result.membership.id,
      metadata: {
        role,
        email,
        createdUser: result.createdUser,
      },
    });

    const accessUrl = this.resolveConsultoriaAccessUrl();
    const delivery = await this.communications.enqueueConsultoriaAccessInvite({
      organizationId,
      recipientName: result.membership.user.name,
      recipientEmail: result.membership.user.email,
      recipientPhone: dto.phone?.trim() || null,
      temporaryPassword,
      accessUrl,
      membershipId: result.membership.id,
      roleLabel: this.roleLabel(role),
    });

    return {
      member: this.mapMember(result.membership),
      temporaryPassword: delivery.enabled ? null : temporaryPassword,
      accessUrl,
      createdUser: result.createdUser,
      delivery,
      warning: delivery.enabled
        ? 'Convite enviado por e-mail/WhatsApp (quando informado). A senha temporaria nao e exibida quando as comunicacoes estao ativas.'
        : 'Comunicacoes desligadas: copie e entregue a senha temporaria manualmente. Configure COMMUNICATIONS_ENABLED e o contato de suporte em Configuracoes.',
    };
  }

  async updateMemberRole(
    organizationId: string,
    actorUserId: string,
    actorRole: string,
    membershipId: string,
    dto: UpdateOrganizationMemberRoleDto,
  ) {
    this.assertCanManageMembers(actorRole);

    const membership = await this.prisma.membership.findFirst({
      where: { id: membershipId, organizationId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });
    if (!membership) {
      throw new NotFoundException('Usuario da consultoria nao encontrado.');
    }

    const nextRole = dto.role;
    if (nextRole === MembershipRole.OWNER) {
      throw new BadRequestException(
        'Para tornar alguem administrador geral, use a transferencia de OWNER.',
      );
    }
    if (
      nextRole !== MembershipRole.ADMIN &&
      nextRole !== MembershipRole.MEMBER
    ) {
      throw new BadRequestException('Papel invalido. Use ADMIN ou MEMBER.');
    }

    if (membership.role === MembershipRole.OWNER) {
      throw new BadRequestException(
        'Nao e possivel rebaixar o OWNER por aqui. Transfira o OWNER primeiro.',
      );
    }

    if (membership.userId === actorUserId && actorRole !== MembershipRole.OWNER) {
      throw new ForbiddenException(
        'Voce nao pode alterar o proprio papel. Peca ao administrador geral.',
      );
    }

    const updated = await this.prisma.membership.update({
      where: { id: membership.id },
      data: { role: nextRole },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    await this.audit.log({
      action: 'organization_member.role_updated',
      organizationId,
      userId: actorUserId,
      entityType: 'Membership',
      entityId: membership.id,
      metadata: {
        from: membership.role,
        to: nextRole,
        email: membership.user.email,
      },
    });

    return this.mapMember(updated);
  }

  /**
   * Transfere o administrador geral (OWNER) para outro membro da equipe.
   * O OWNER atual vira ADMIN.
   */
  async transferOwnership(
    organizationId: string,
    actorUserId: string,
    actorRole: string,
    targetMembershipId: string,
  ) {
    if (actorRole !== MembershipRole.OWNER) {
      throw new ForbiddenException(
        'Apenas o administrador geral (OWNER) pode transferir o OWNER.',
      );
    }

    const currentOwner = await this.prisma.membership.findFirst({
      where: {
        organizationId,
        userId: actorUserId,
        role: MembershipRole.OWNER,
      },
    });
    if (!currentOwner) {
      throw new ForbiddenException(
        'Sua sessao nao e o OWNER atual desta consultoria.',
      );
    }

    const target = await this.prisma.membership.findFirst({
      where: { id: targetMembershipId, organizationId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });
    if (!target) {
      throw new NotFoundException('Membro destino nao encontrado.');
    }
    if (target.id === currentOwner.id) {
      throw new BadRequestException('Este usuario ja e o administrador geral.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.membership.update({
        where: { id: currentOwner.id },
        data: { role: MembershipRole.ADMIN },
      });
      await tx.membership.update({
        where: { id: target.id },
        data: { role: MembershipRole.OWNER },
      });
    });

    await this.audit.log({
      action: 'organization_member.ownership_transferred',
      organizationId,
      userId: actorUserId,
      entityType: 'Membership',
      entityId: target.id,
      metadata: {
        previousOwnerMembershipId: currentOwner.id,
        newOwnerUserId: target.userId,
        newOwnerEmail: target.user.email,
      },
    });

    return this.listMembers(organizationId);
  }

  async resetMemberPassword(
    organizationId: string,
    actorUserId: string,
    actorRole: string,
    membershipId: string,
  ) {
    this.assertCanManageMembers(actorRole);

    const membership = await this.prisma.membership.findFirst({
      where: { id: membershipId, organizationId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });
    if (!membership) {
      throw new NotFoundException('Usuario da consultoria nao encontrado.');
    }

    if (
      membership.role === MembershipRole.OWNER &&
      actorRole !== MembershipRole.OWNER
    ) {
      throw new ForbiddenException(
        'Apenas o OWNER pode redefinir a senha do administrador geral.',
      );
    }

    const temporaryPassword = this.generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);
    await this.prisma.user.update({
      where: { id: membership.userId },
      data: { passwordHash, mustChangePassword: true },
    });

    await this.audit.log({
      action: 'organization_member.password_reset',
      organizationId,
      userId: actorUserId,
      entityType: 'Membership',
      entityId: membership.id,
      metadata: { email: membership.user.email },
    });

    const accessUrl = this.resolveConsultoriaAccessUrl();
    const delivery = await this.communications.enqueueConsultoriaAccessInvite({
      organizationId,
      recipientName: membership.user.name,
      recipientEmail: membership.user.email,
      recipientPhone: null,
      temporaryPassword,
      accessUrl,
      membershipId: membership.id,
      roleLabel: this.roleLabel(membership.role),
    });

    return {
      member: this.mapMember(membership),
      temporaryPassword: delivery.enabled ? null : temporaryPassword,
      accessUrl,
      delivery,
      warning: delivery.enabled
        ? 'Nova senha enviada por e-mail (quando as comunicacoes estiverem ativas).'
        : 'Comunicacoes desligadas: copie a senha temporaria e entregue manualmente.',
    };
  }

  async removeMember(
    organizationId: string,
    actorUserId: string,
    actorRole: string,
    membershipId: string,
  ) {
    this.assertCanManageMembers(actorRole);

    const membership = await this.prisma.membership.findFirst({
      where: { id: membershipId, organizationId },
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    });
    if (!membership) {
      throw new NotFoundException('Usuario da consultoria nao encontrado.');
    }
    if (membership.role === MembershipRole.OWNER) {
      throw new BadRequestException(
        'Nao e possivel remover o administrador geral. Transfira o OWNER antes.',
      );
    }
    if (membership.userId === actorUserId) {
      throw new BadRequestException(
        'Voce nao pode remover o proprio acesso.',
      );
    }

    await this.prisma.membership.delete({ where: { id: membership.id } });

    await this.audit.log({
      action: 'organization_member.removed',
      organizationId,
      userId: actorUserId,
      entityType: 'Membership',
      entityId: membershipId,
      metadata: {
        email: membership.user.email,
        role: membership.role,
      },
    });

    return { ok: true as const };
  }

  async getBranding(organizationId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true, logoPath: true },
    });
    if (!organization) {
      throw new NotFoundException('Organizacao nao encontrada.');
    }
    return {
      name: organization.name,
      hasLogo: Boolean(organization.logoPath),
    };
  }

  async uploadLogo(
    organizationId: string,
    actorUserId: string,
    actorRole: string,
    file: Express.Multer.File | undefined,
  ) {
    this.assertCanManageBrand(actorRole);
    if (!file?.buffer?.length) {
      throw new BadRequestException('Envie um arquivo de logo.');
    }
    if (file.size > 2 * 1024 * 1024) {
      throw new BadRequestException('Logo deve ter no maximo 2 MB.');
    }

    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { logoPath: true },
    });
    if (!organization) {
      throw new NotFoundException('Organizacao nao encontrada.');
    }

    let saved;
    try {
      saved = await saveOrgLogoFile({
        organizationId,
        buffer: file.buffer,
        mimeType: file.mimetype,
        originalName: file.originalname,
      });
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Nao foi possivel gravar o logo.',
      );
    }

    if (organization.logoPath && organization.logoPath !== saved.relativePath) {
      await deleteOrgLogoFile(organization.logoPath);
    }

    await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        logoPath: saved.relativePath,
        logoMimeType: saved.mimeType,
      },
    });

    await this.audit.log({
      action: 'organization.logo_uploaded',
      organizationId,
      userId: actorUserId,
      entityType: 'Organization',
      entityId: organizationId,
    });

    return { hasLogo: true };
  }

  async deleteLogo(
    organizationId: string,
    actorUserId: string,
    actorRole: string,
  ) {
    this.assertCanManageBrand(actorRole);
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { logoPath: true },
    });
    if (!organization) {
      throw new NotFoundException('Organizacao nao encontrada.');
    }
    await deleteOrgLogoFile(organization.logoPath);
    await this.prisma.organization.update({
      where: { id: organizationId },
      data: { logoPath: null, logoMimeType: null },
    });
    await this.audit.log({
      action: 'organization.logo_removed',
      organizationId,
      userId: actorUserId,
      entityType: 'Organization',
      entityId: organizationId,
    });
    return { hasLogo: false };
  }

  async streamLogo(organizationId: string, res: Response) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { logoPath: true, logoMimeType: true },
    });
    if (!organization?.logoPath) {
      throw new NotFoundException('Esta consultoria ainda nao enviou logo.');
    }
    const absolute = resolveOrgLogoAbsolutePath(organization.logoPath);
    if (!absolute || !existsSync(absolute)) {
      throw new NotFoundException('Arquivo de logo nao encontrado.');
    }
    res.setHeader('Content-Type', organization.logoMimeType || 'image/png');
    res.setHeader('Cache-Control', 'private, max-age=300');
    createReadStream(absolute).pipe(res);
  }

  private assertCanManageBrand(actorRole: string) {
    if (
      actorRole !== MembershipRole.OWNER &&
      actorRole !== MembershipRole.ADMIN
    ) {
      throw new ForbiddenException(
        'Apenas OWNER ou ADMIN podem alterar a marca da consultoria.',
      );
    }
  }

  private assertCanManageMembers(actorRole: string) {
    if (
      actorRole !== MembershipRole.OWNER &&
      actorRole !== MembershipRole.ADMIN
    ) {
      throw new ForbiddenException(
        'Apenas OWNER ou ADMIN podem gerenciar a equipe da consultoria.',
      );
    }
  }

  private roleLabel(role: MembershipRole) {
    if (role === MembershipRole.OWNER) return 'Administrador geral';
    if (role === MembershipRole.ADMIN) return 'Administrador';
    return 'Membro';
  }

  private mapMember(row: {
    id: string;
    role: MembershipRole;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    user: {
      id: string;
      name: string;
      email: string;
      createdAt: Date;
      updatedAt: Date;
    };
  }) {
    return {
      id: row.id,
      userId: row.userId,
      role: row.role,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      user: {
        id: row.user.id,
        name: row.user.name,
        email: row.user.email,
        createdAt: row.user.createdAt.toISOString(),
        updatedAt: row.user.updatedAt.toISOString(),
      },
    };
  }

  private generateTemporaryPassword(): string {
    const alphabet =
      'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$';
    const bytes = randomBytes(14);
    let out = '';
    for (let i = 0; i < 14; i += 1) {
      out += alphabet[bytes[i] % alphabet.length];
    }
    return out;
  }

  private resolveConsultoriaAccessUrl(): string {
    const fromEnv =
      process.env.WEB_APP_URL?.trim() ||
      process.env.CORS_ORIGIN?.split(',')[0]?.trim();
    const base = (fromEnv || 'http://localhost:3000').replace(/\/$/, '');
    if (base.endsWith('/login')) return base;
    return `${base}/login`;
  }

  /**
   * Limpa dados operacionais de teste do tenant.
   * Mantem Organization, Users, Memberships, contatos e base CAEPI global.
   */
  async hardResetOperationalData(
    organizationId: string,
    userId: string,
    membershipRole: string,
    confirmation: string,
  ): Promise<HardResetSummary> {
    if (membershipRole !== MembershipRole.OWNER) {
      throw new ForbiddenException(
        'Apenas OWNER pode executar o hard reset operacional.',
      );
    }

    if (confirmation.trim().toUpperCase() !== 'RESETAR') {
      throw new BadRequestException(
        'Confirmacao invalida. Digite exatamente RESETAR para continuar.',
      );
    }

    const summary: HardResetSummary = {
      servedClients: 0,
      workers: 0,
      epiItems: 0,
      epiNeeds: 0,
      stockLocations: 0,
      occupationalRisks: 0,
      pgroImportRuns: 0,
      clientUsers: 0,
      auditLogs: 0,
      epiDeliveries: 0,
      facialReferences: 0,
    };

    try {
      await this.prisma.$transaction(async (tx) => {
        summary.workers = await tx.worker.count({ where: { organizationId } });
        summary.clientUsers = await tx.clientUserMembership.count({
          where: { organizationId },
        });
        summary.servedClients = await tx.servedClient.count({
          where: { organizationId },
        });
        summary.epiItems = await tx.epiItem.count({ where: { organizationId } });
        summary.epiNeeds = await tx.epiNeed.count({ where: { organizationId } });
        summary.stockLocations = await tx.stockLocation.count({
          where: { organizationId },
        });
        summary.occupationalRisks = await tx.occupationalRisk.count({
          where: { organizationId },
        });
        summary.pgroImportRuns = await tx.pgroImportRun.count({
          where: { organizationId },
        });
        summary.auditLogs = await tx.auditLog.count({
          where: { organizationId },
        });
        summary.epiDeliveries = await tx.epiDelivery.count({
          where: { organizationId },
        });
        summary.facialReferences = await tx.workerFacialReference.count({
          where: { organizationId },
        });

        // 1) Cadeia de entregas (FKs Restrict em worker/item/estoque)
        await tx.epiDeliveryReturnItem.deleteMany({
          where: { returnEvent: { organizationId } },
        });
        await tx.epiDeliveryReturn.deleteMany({ where: { organizationId } });
        await tx.deliveryEvidence.deleteMany({
          where: { delivery: { organizationId } },
        });
        await tx.epiDeliveryItem.deleteMany({
          where: { delivery: { organizationId } },
        });
        await tx.epiDelivery.deleteMany({ where: { organizationId } });

        // 2) Biometria (antes dos trabalhadores)
        await tx.workerFacialEnrollmentLink.deleteMany({
          where: { organizationId },
        });
        await tx.workerBiometricConsent.deleteMany({
          where: { organizationId },
        });
        await tx.workerFacialReference.deleteMany({
          where: { organizationId },
        });

        // 3) Estoque
        await tx.epiStockMovement.deleteMany({ where: { organizationId } });
        await tx.epiStockBalance.deleteMany({ where: { organizationId } });
        await tx.stockLocation.deleteMany({ where: { organizationId } });

        // 4) Estrutura / pessoas / clientes
        await tx.epiItemNeed.deleteMany({ where: { organizationId } });
        await tx.jobFunctionEpiRequirement.deleteMany({
          where: { organizationId },
        });
        await tx.jobFunctionRisk.deleteMany({ where: { organizationId } });
        await tx.pgroImportRun.deleteMany({ where: { organizationId } });
        await tx.clientUserMembership.deleteMany({ where: { organizationId } });
        await tx.communicationOutbox.deleteMany({ where: { organizationId } });
        await tx.worker.deleteMany({ where: { organizationId } });
        await tx.clientJobFunction.deleteMany({ where: { organizationId } });
        await tx.clientSector.deleteMany({ where: { organizationId } });
        await tx.operationalUnit.deleteMany({ where: { organizationId } });
        await tx.clientSubscription.deleteMany({ where: { organizationId } });
        await tx.servedClient.deleteMany({ where: { organizationId } });

        // 5) Catalogo do tenant
        await tx.epiVariant.deleteMany({ where: { organizationId } });
        await tx.epiItem.deleteMany({ where: { organizationId } });
        await tx.epiNeed.deleteMany({ where: { organizationId } });
        await tx.occupationalRisk.deleteMany({ where: { organizationId } });

        await tx.auditLog.deleteMany({ where: { organizationId } });
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Falha desconhecida no hard reset.';
      this.logger.error(`Hard reset falhou: ${message}`);
      throw new BadRequestException(
        `Nao foi possivel concluir o hard reset: ${message.slice(0, 240)}`,
      );
    }

    // Arquivos biometricos do tenant (melhor esforco; DB ja limpo).
    await Promise.all([
      rm(join(getWorkerFaceReferenceRoot(), organizationId), {
        recursive: true,
        force: true,
      }).catch(() => undefined),
      rm(join(getDeliveryEvidenceRoot(), organizationId), {
        recursive: true,
        force: true,
      }).catch(() => undefined),
    ]);

    await this.audit.log({
      action: 'organization.hard_reset',
      organizationId,
      userId,
      entityType: 'Organization',
      entityId: organizationId,
      metadata: {
        confirmation: 'RESETAR',
        deleted: summary,
        preserved: [
          'Organization',
          'User',
          'Membership',
          'CaCertificate (global)',
        ],
      },
    });

    return summary;
  }
}
