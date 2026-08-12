import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  MembershipRole,
  OrganizationContactRole,
  OrganizationStatus,
  ServedClientStatus,
  WorkerStatus,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { rm } from 'fs/promises';
import { join } from 'path';
import { AuditService } from '../audit/audit.service';
import { COMM_TEMPLATE_CONSULTORIA_ACCESS_INVITE } from '../communications/communication.templates';
import { CommunicationsService } from '../communications/communications.service';
import { normalizeWhatsappNumber } from '../communications/evolution-whatsapp.sender';
import { deleteOrgLogoFile } from '../organization/org-logo.storage';
import { getInvoiceDocumentsRoot } from '../portal/invoice-document.storage';
import { getDeliveryEvidenceRoot } from '../portal/facial-evidence.storage';
import { PrismaService } from '../prisma/prisma.service';
import { getWorkerFaceReferenceRoot } from '../workers/worker-face-reference.storage';
import type { CreatePlatformTenantDto } from './dto/create-tenant.dto';
import type { DestroyPlatformTenantDto } from './dto/destroy-tenant.dto';
import type { GrantPlatformLivesDto } from './dto/grant-lives.dto';
import type { SuspendPlatformTenantDto } from './dto/suspend-tenant.dto';
import type { UpdatePlatformTenantDto } from './dto/update-tenant.dto';

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

@Injectable()
export class PlatformService {
  private readonly logger = new Logger(PlatformService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly communications: CommunicationsService,
  ) {}

  async overview() {
    const orgs = await this.prisma.organization.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        memberships: {
          where: { role: MembershipRole.OWNER },
          take: 1,
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    const orgIds = orgs.map((org) => org.id);
    const [contacts, invites] = await Promise.all([
      orgIds.length
        ? this.prisma.organizationContact.findMany({
            where: { organizationId: { in: orgIds }, isPrimary: true },
            select: {
              organizationId: true,
              phone: true,
              email: true,
            },
          })
        : Promise.resolve([]),
      orgIds.length
        ? this.prisma.communicationOutbox.findMany({
            where: {
              organizationId: { in: orgIds },
              templateKey: COMM_TEMPLATE_CONSULTORIA_ACCESS_INVITE,
            },
            orderBy: { createdAt: 'desc' },
            select: {
              organizationId: true,
              channel: true,
              status: true,
              errorMessage: true,
              createdAt: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const phoneByOrg = new Map(
      contacts.map((row) => [row.organizationId, row.phone]),
    );
    const inviteByOrg = new Map<
      string,
      {
        email: string | null;
        whatsapp: string | null;
        emailError: string | null;
        whatsappError: string | null;
        at: string | null;
      }
    >();
    for (const row of invites) {
      const current = inviteByOrg.get(row.organizationId) ?? {
        email: null,
        whatsapp: null,
        emailError: null,
        whatsappError: null,
        at: row.createdAt.toISOString(),
      };
      if (row.channel === 'EMAIL' && !current.email) {
        current.email = row.status;
        current.emailError = row.errorMessage;
        current.at = row.createdAt.toISOString();
      }
      if (row.channel === 'WHATSAPP' && !current.whatsapp) {
        current.whatsapp = row.status;
        current.whatsappError = row.errorMessage;
        if (!current.at) current.at = row.createdAt.toISOString();
      }
      inviteByOrg.set(row.organizationId, current);
    }

    const rows = await Promise.all(
      orgs.map((org) =>
        this.toTenantRow(org, {
          ownerPhone: phoneByOrg.get(org.id) ?? null,
          invite: inviteByOrg.get(org.id) ?? null,
        }),
      ),
    );

    const active = rows.filter((row) => row.status === 'ACTIVE');
    const contracted = rows.reduce((sum, row) => sum + row.contractedLifeQuota, 0);
    const allocated = rows.reduce((sum, row) => sum + row.allocatedLives, 0);
    return {
      tenants: {
        total: rows.length,
        active: active.length,
        suspended: rows.length - active.length,
        nearLimit: active.filter(
          (row) =>
            row.contractedLifeQuota > 0 &&
            row.availableLives / row.contractedLifeQuota <= 0.1,
        ).length,
      },
      lives: {
        contracted,
        allocated,
        used: rows.reduce((sum, row) => sum + row.usedLives, 0),
        occupancyPercent:
          contracted > 0 ? Math.round((allocated / contracted) * 100) : 0,
      },
      wholesaleMonthlyCents: active.reduce(
        (sum, row) => sum + row.wholesaleMonthlyCents,
        0,
      ),
      rows,
    };
  }

  async createTenant(actorUserId: string, dto: CreatePlatformTenantDto) {
    const name = dto.name.trim();
    const ownerName = dto.ownerName.trim();
    const ownerEmail = dto.ownerEmail.trim().toLowerCase();
    const ownerPhone = normalizeWhatsappNumber(dto.ownerPhone);
    if (!name || !ownerName || !ownerEmail) {
      throw new BadRequestException('Informe consultoria, gestor e e-mail.');
    }
    if (!ownerPhone) {
      throw new BadRequestException(
        'Informe o WhatsApp do gestor com DDD (ex.: 11999999999).',
      );
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: ownerEmail },
      include: { memberships: { take: 1 } },
    });
    if (existingUser && existingUser.memberships.length > 0) {
      throw new ConflictException(
        'Este e-mail ja e gestor de outra consultoria.',
      );
    }

    const slug = await this.ensureUniqueSlug(slugify(name) || 'consultoria');
    const reuseUser = Boolean(existingUser);
    const temporaryPassword = reuseUser
      ? null
      : this.generateTemporaryPassword();
    const passwordHash = reuseUser
      ? null
      : await bcrypt.hash(temporaryPassword as string, 12);

    const created = await this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name,
          slug,
          contractedLifeQuota: dto.contractedLifeQuota,
          wholesaleUnitPriceCents: dto.wholesaleUnitPriceCents,
          status: OrganizationStatus.ACTIVE,
        },
      });

      const user = existingUser
        ? await tx.user.update({
            where: { id: existingUser.id },
            data: { name: ownerName || existingUser.name },
          })
        : await tx.user.create({
            data: {
              email: ownerEmail,
              name: ownerName,
              passwordHash: passwordHash as string,
            },
          });

      const membership = await tx.membership.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          role: MembershipRole.OWNER,
        },
      });

      await tx.organizationContact.create({
        data: {
          organizationId: organization.id,
          name: ownerName,
          email: ownerEmail,
          phone: ownerPhone,
          role: OrganizationContactRole.SUPPORT,
          isPrimary: true,
          isActive: true,
        },
      });

      return { organization, user, membership };
    });

    const accessUrl = this.resolveConsultoriaAccessUrl();
    const keepCurrentPassword = Boolean(existingUser?.isPlatformAdmin);
    const invitePassword =
      temporaryPassword ??
      (keepCurrentPassword
        ? 'use a senha ja cadastrada'
        : this.generateTemporaryPassword());
    if (reuseUser && !keepCurrentPassword) {
      await this.prisma.user.update({
        where: { id: created.user.id },
        data: { passwordHash: await bcrypt.hash(invitePassword, 12) },
      });
    }
    const delivery = await this.communications.enqueueConsultoriaAccessInvite({
      organizationId: created.organization.id,
      recipientName: ownerName,
      recipientEmail: ownerEmail,
      recipientPhone: ownerPhone,
      temporaryPassword: invitePassword,
      accessUrl,
      membershipId: created.membership.id,
      roleLabel: 'Administrador geral',
    });

    await this.audit.log({
      action: 'platform.tenant_created',
      organizationId: created.organization.id,
      userId: actorUserId,
      entityType: 'Organization',
      entityId: created.organization.id,
      metadata: {
        ownerEmail,
        contractedLifeQuota: dto.contractedLifeQuota,
        wholesaleUnitPriceCents: dto.wholesaleUnitPriceCents,
      },
    });

    const tenant = await this.getTenantRow(created.organization.id);
    return {
      tenant,
      owner: {
        name: ownerName,
        email: ownerEmail,
        phone: ownerPhone,
        temporaryPassword:
          keepCurrentPassword || delivery.email === 'SENT'
            ? null
            : invitePassword,
        accessUrl,
        createdUser: !reuseUser,
        deliveryEnabled: delivery.enabled,
        emailStatus: delivery.email,
        whatsappStatus: delivery.whatsapp,
        emailError: delivery.emailError ?? null,
        whatsappError: delivery.whatsappError ?? null,
      },
    };
  }

  async updateTenant(
    actorUserId: string,
    organizationId: string,
    dto: UpdatePlatformTenantDto,
  ) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!organization) {
      throw new NotFoundException('Consultoria nao encontrada.');
    }

    if (dto.contractedLifeQuota != null) {
      const allocated = await this.allocatedLives(organizationId);
      if (dto.contractedLifeQuota < allocated) {
        throw new BadRequestException(
          `A franquia nao pode ser menor que as ${allocated} vidas ja alocadas aos clientes.`,
        );
      }
    }

    await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        ...(dto.name?.trim() ? { name: dto.name.trim() } : {}),
        ...(dto.contractedLifeQuota != null
          ? { contractedLifeQuota: dto.contractedLifeQuota }
          : {}),
        ...(dto.wholesaleUnitPriceCents != null
          ? { wholesaleUnitPriceCents: dto.wholesaleUnitPriceCents }
          : {}),
      },
    });

    if (dto.ownerPhone !== undefined) {
      const phone = normalizeWhatsappNumber(dto.ownerPhone);
      if (!phone) {
        throw new BadRequestException(
          'Informe o WhatsApp do gestor com DDD (ex.: 11999999999).',
        );
      }
      const ownerMembership = await this.prisma.membership.findFirst({
        where: { organizationId, role: MembershipRole.OWNER },
        include: { user: { select: { name: true, email: true } } },
      });
      const existingContact = await this.prisma.organizationContact.findFirst({
        where: { organizationId, isPrimary: true },
      });
      if (existingContact) {
        await this.prisma.organizationContact.update({
          where: { id: existingContact.id },
          data: { phone, isActive: true },
        });
      } else {
        await this.prisma.organizationContact.create({
          data: {
            organizationId,
            name: ownerMembership?.user.name ?? organization.name,
            email: ownerMembership?.user.email ?? null,
            phone,
            role: OrganizationContactRole.SUPPORT,
            isPrimary: true,
            isActive: true,
          },
        });
      }
    }

    await this.audit.log({
      action: 'platform.tenant_updated',
      organizationId,
      userId: actorUserId,
      entityType: 'Organization',
      entityId: organizationId,
      metadata: {
        name: dto.name ?? null,
        contractedLifeQuota: dto.contractedLifeQuota ?? null,
        wholesaleUnitPriceCents: dto.wholesaleUnitPriceCents ?? null,
      },
    });

    return this.getTenantRow(organizationId);
  }

  async grantLives(
    actorUserId: string,
    organizationId: string,
    dto: GrantPlatformLivesDto,
  ) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!organization) {
      throw new NotFoundException('Consultoria nao encontrada.');
    }
    const nextQuota = organization.contractedLifeQuota + dto.addLives;
    await this.prisma.organization.update({
      where: { id: organizationId },
      data: { contractedLifeQuota: nextQuota },
    });
    await this.audit.log({
      action: 'platform.lives_granted',
      organizationId,
      userId: actorUserId,
      entityType: 'Organization',
      entityId: organizationId,
      metadata: {
        addLives: dto.addLives,
        previous: organization.contractedLifeQuota,
        next: nextQuota,
      },
    });
    return this.getTenantRow(organizationId);
  }

  async resendAccess(actorUserId: string, organizationId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        memberships: {
          where: { role: MembershipRole.OWNER },
          take: 1,
          include: { user: true },
        },
        contacts: {
          where: { isPrimary: true },
          take: 1,
        },
      },
    });
    if (!organization) {
      throw new NotFoundException('Consultoria nao encontrada.');
    }
    const owner = organization.memberships[0]?.user;
    if (!owner) {
      throw new BadRequestException('Consultoria sem gestor dono.');
    }
    const phone =
      normalizeWhatsappNumber(organization.contacts[0]?.phone ?? '') || null;

    const keepCurrentPassword = owner.isPlatformAdmin;
    const temporaryPassword = keepCurrentPassword
      ? 'use a senha ja cadastrada'
      : this.generateTemporaryPassword();
    if (!keepCurrentPassword) {
      await this.prisma.user.update({
        where: { id: owner.id },
        data: { passwordHash: await bcrypt.hash(temporaryPassword, 12) },
      });
    }

    const accessUrl = this.resolveConsultoriaAccessUrl();
    const delivery = await this.communications.enqueueConsultoriaAccessInvite({
      organizationId,
      recipientName: owner.name,
      recipientEmail: owner.email,
      recipientPhone: phone,
      temporaryPassword,
      accessUrl,
      membershipId: organization.memberships[0].id,
      roleLabel: 'Administrador geral',
    });

    await this.audit.log({
      action: 'platform.access_resent',
      organizationId,
      userId: actorUserId,
      entityType: 'User',
      entityId: owner.id,
      metadata: {
        email: delivery.email,
        whatsapp: delivery.whatsapp,
      },
    });

    return {
      tenant: await this.getTenantRow(organizationId),
      owner: {
        name: owner.name,
        email: owner.email,
        phone,
        temporaryPassword:
          keepCurrentPassword || delivery.email === 'SENT'
            ? null
            : temporaryPassword,
        accessUrl,
        createdUser: false,
        deliveryEnabled: delivery.enabled,
        emailStatus: delivery.email,
        whatsappStatus: delivery.whatsapp,
        emailError: delivery.emailError ?? null,
        whatsappError: delivery.whatsappError ?? null,
      },
    };
  }

  async suspendTenant(
    actorUserId: string,
    organizationId: string,
    dto: SuspendPlatformTenantDto,
  ) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!organization) {
      throw new NotFoundException('Consultoria nao encontrada.');
    }
    if (organization.status === OrganizationStatus.SUSPENDED) {
      throw new BadRequestException('Esta consultoria ja esta suspensa.');
    }

    await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        status: OrganizationStatus.SUSPENDED,
        suspendedAt: new Date(),
        suspendReason: dto.reason?.trim() || 'Suspensa pela ProntEPI.',
      },
    });

    await this.audit.log({
      action: 'platform.tenant_suspended',
      organizationId,
      userId: actorUserId,
      entityType: 'Organization',
      entityId: organizationId,
      metadata: { reason: dto.reason?.trim() || null },
    });

    return this.getTenantRow(organizationId);
  }

  async activateTenant(actorUserId: string, organizationId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!organization) {
      throw new NotFoundException('Consultoria nao encontrada.');
    }
    if (organization.status === OrganizationStatus.ACTIVE) {
      throw new BadRequestException('Esta consultoria ja esta ativa.');
    }

    await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        status: OrganizationStatus.ACTIVE,
        suspendedAt: null,
        suspendReason: null,
      },
    });

    await this.audit.log({
      action: 'platform.tenant_activated',
      organizationId,
      userId: actorUserId,
      entityType: 'Organization',
      entityId: organizationId,
    });

    return this.getTenantRow(organizationId);
  }

  async destroyTenant(
    actorUserId: string,
    organizationId: string,
    dto: DestroyPlatformTenantDto,
  ) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        memberships: { select: { userId: true } },
        clientUserMemberships: { select: { userId: true } },
      },
    });
    if (!organization) {
      throw new NotFoundException('Consultoria nao encontrada.');
    }
    if (
      dto.confirmation.trim().toLowerCase() !==
      organization.name.trim().toLowerCase()
    ) {
      throw new BadRequestException(
        `Digite exatamente o nome da consultoria (${organization.name}) para zerar.`,
      );
    }

    const candidateUserIds = [
      ...new Set(
        [
          ...organization.memberships.map((row) => row.userId),
          ...organization.clientUserMemberships
            .map((row) => row.userId)
            .filter((id): id is string => Boolean(id)),
        ].filter((id) => id !== actorUserId),
      ),
    ];

    try {
      await this.prisma.$transaction(async (tx) => {
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
        await tx.workerFacialEnrollmentLink.deleteMany({
          where: { organizationId },
        });
        await tx.workerBiometricConsent.deleteMany({
          where: { organizationId },
        });
        await tx.workerFacialReference.deleteMany({
          where: { organizationId },
        });
        await tx.epiStockMovement.deleteMany({ where: { organizationId } });
        await tx.epiStockBalance.deleteMany({ where: { organizationId } });
        await tx.stockLocation.deleteMany({ where: { organizationId } });
        await tx.invoiceDocument.deleteMany({ where: { organizationId } });
        await tx.epiItemNeed.deleteMany({ where: { organizationId } });
        await tx.jobFunctionEpiRequirement.deleteMany({
          where: { organizationId },
        });
        await tx.jobFunctionRisk.deleteMany({ where: { organizationId } });
        await tx.pgroImportRun.deleteMany({ where: { organizationId } });
        await tx.clientUserMembership.deleteMany({
          where: { organizationId },
        });
        await tx.communicationOutbox.deleteMany({ where: { organizationId } });
        await tx.worker.deleteMany({ where: { organizationId } });
        await tx.clientJobFunction.deleteMany({ where: { organizationId } });
        await tx.clientSector.deleteMany({ where: { organizationId } });
        await tx.operationalUnit.deleteMany({ where: { organizationId } });
        await tx.clientSubscription.deleteMany({ where: { organizationId } });
        await tx.servedClient.deleteMany({ where: { organizationId } });
        await tx.epiVariant.deleteMany({ where: { organizationId } });
        await tx.epiItem.deleteMany({ where: { organizationId } });
        await tx.epiNeed.deleteMany({ where: { organizationId } });
        await tx.occupationalRisk.deleteMany({ where: { organizationId } });
        await tx.lifePriceReducer.deleteMany({
          where: { pricing: { organizationId } },
        });
        await tx.organizationLifePricing.deleteMany({
          where: { organizationId },
        });
        await tx.organizationContact.deleteMany({ where: { organizationId } });
        await tx.membership.deleteMany({ where: { organizationId } });
        await tx.auditLog.deleteMany({ where: { organizationId } });
        await tx.organization.delete({ where: { id: organizationId } });
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Falha ao zerar a consultoria.';
      this.logger.error(`Destroy tenant falhou: ${message}`);
      throw new BadRequestException(
        `Nao foi possivel zerar a consultoria: ${message.slice(0, 240)}`,
      );
    }

    if (candidateUserIds.length > 0) {
      const leftover = await this.prisma.user.findMany({
        where: { id: { in: candidateUserIds } },
        select: {
          id: true,
          isPlatformAdmin: true,
          _count: {
            select: { memberships: true, clientUserMemberships: true },
          },
        },
      });
      const orphanIds = leftover
        .filter(
          (user) =>
            !user.isPlatformAdmin &&
            user._count.memberships === 0 &&
            user._count.clientUserMemberships === 0,
        )
        .map((user) => user.id);
      if (orphanIds.length > 0) {
        await this.prisma.user.deleteMany({ where: { id: { in: orphanIds } } });
      }
    }

    await Promise.all([
      deleteOrgLogoFile(organization.logoPath),
      rm(join(getWorkerFaceReferenceRoot(), organizationId), {
        recursive: true,
        force: true,
      }).catch(() => undefined),
      rm(join(getDeliveryEvidenceRoot(), organizationId), {
        recursive: true,
        force: true,
      }).catch(() => undefined),
      rm(join(getInvoiceDocumentsRoot(), organizationId), {
        recursive: true,
        force: true,
      }).catch(() => undefined),
    ]);

    await this.audit.log({
      action: 'platform.tenant_destroyed',
      userId: actorUserId,
      entityType: 'Organization',
      entityId: organizationId,
      metadata: { name: organization.name, slug: organization.slug },
    });

    return { ok: true as const, name: organization.name };
  }

  private async getTenantRow(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        memberships: {
          where: { role: MembershipRole.OWNER },
          take: 1,
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });
    if (!org) {
      throw new NotFoundException('Consultoria nao encontrada.');
    }
    const [contact, inviteRows] = await Promise.all([
      this.prisma.organizationContact.findFirst({
        where: { organizationId, isPrimary: true },
        select: { phone: true },
      }),
      this.prisma.communicationOutbox.findMany({
        where: {
          organizationId,
          templateKey: COMM_TEMPLATE_CONSULTORIA_ACCESS_INVITE,
        },
        orderBy: { createdAt: 'desc' },
        take: 4,
        select: {
          channel: true,
          status: true,
          errorMessage: true,
          createdAt: true,
        },
      }),
    ]);
    const invite = {
      email: null as string | null,
      whatsapp: null as string | null,
      emailError: null as string | null,
      whatsappError: null as string | null,
      at: inviteRows[0]?.createdAt.toISOString() ?? null,
    };
    for (const row of inviteRows) {
      if (row.channel === 'EMAIL' && !invite.email) {
        invite.email = row.status;
        invite.emailError = row.errorMessage;
      }
      if (row.channel === 'WHATSAPP' && !invite.whatsapp) {
        invite.whatsapp = row.status;
        invite.whatsappError = row.errorMessage;
      }
    }
    return this.toTenantRow(org, {
      ownerPhone: contact?.phone ?? null,
      invite,
    });
  }

  private async toTenantRow(
    org: {
      id: string;
      name: string;
      slug: string;
      status: OrganizationStatus;
      contractedLifeQuota: number;
      wholesaleUnitPriceCents: number;
      createdAt: Date;
      suspendedAt: Date | null;
      suspendReason: string | null;
      memberships: Array<{
        user: { id: string; name: string; email: string };
      }>;
    },
    extras?: {
      ownerPhone?: string | null;
      invite?: {
        email: string | null;
        whatsapp: string | null;
        emailError: string | null;
        whatsappError: string | null;
        at: string | null;
      } | null;
    },
  ) {
    const [allocatedAgg, used, activeClients] = await Promise.all([
      this.prisma.servedClient.aggregate({
        where: { organizationId: org.id, status: ServedClientStatus.ACTIVE },
        _sum: { allocatedLifeQuota: true },
      }),
      this.prisma.worker.count({
        where: {
          organizationId: org.id,
          status: WorkerStatus.ACTIVE,
          servedClient: { status: ServedClientStatus.ACTIVE },
        },
      }),
      this.prisma.servedClient.count({
        where: { organizationId: org.id, status: ServedClientStatus.ACTIVE },
      }),
    ]);

    const allocatedLives = allocatedAgg._sum.allocatedLifeQuota ?? 0;
    const owner = org.memberships[0]?.user ?? null;

    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      status: org.status,
      contractedLifeQuota: org.contractedLifeQuota,
      allocatedLives,
      usedLives: used,
      availableLives: Math.max(0, org.contractedLifeQuota - allocatedLives),
      wholesaleUnitPriceCents: org.wholesaleUnitPriceCents,
      wholesaleMonthlyCents:
        org.contractedLifeQuota * org.wholesaleUnitPriceCents,
      activeClients,
      occupancyPercent:
        org.contractedLifeQuota > 0
          ? Math.round((allocatedLives / org.contractedLifeQuota) * 100)
          : 0,
      owner: owner
        ? {
            id: owner.id,
            name: owner.name,
            email: owner.email,
            phone: extras?.ownerPhone ?? null,
          }
        : null,
      invite: extras?.invite ?? null,
      createdAt: org.createdAt.toISOString(),
      suspendedAt: org.suspendedAt?.toISOString() ?? null,
      suspendReason: org.suspendReason,
    };
  }

  private async allocatedLives(organizationId: string) {
    const agg = await this.prisma.servedClient.aggregate({
      where: { organizationId, status: ServedClientStatus.ACTIVE },
      _sum: { allocatedLifeQuota: true },
    });
    return agg._sum.allocatedLifeQuota ?? 0;
  }

  private async ensureUniqueSlug(base: string) {
    let candidate = base;
    let suffix = 1;
    while (
      await this.prisma.organization.findUnique({ where: { slug: candidate } })
    ) {
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }
    return candidate;
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
      process.env.PUBLIC_WEB_URL?.trim() ||
      process.env.CORS_ORIGIN?.split(',')[0]?.trim();
    const base = (fromEnv || 'http://localhost:3000').replace(/\/$/, '');
    if (base.endsWith('/login')) return base;
    return `${base}/login`;
  }
}
