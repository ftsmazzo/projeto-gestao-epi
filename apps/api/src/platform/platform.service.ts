import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  MembershipRole,
  OrganizationStatus,
  ServedClientStatus,
  WorkerStatus,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { rm } from 'fs/promises';
import { join } from 'path';
import { AuditService } from '../audit/audit.service';
import { CommunicationsService } from '../communications/communications.service';
import { deleteOrgLogoFile } from '../organization/org-logo.storage';
import { getInvoiceDocumentsRoot } from '../portal/invoice-document.storage';
import { getDeliveryEvidenceRoot } from '../portal/facial-evidence.storage';
import { PrismaService } from '../prisma/prisma.service';
import { getWorkerFaceReferenceRoot } from '../workers/worker-face-reference.storage';
import type { CreatePlatformTenantDto } from './dto/create-tenant.dto';
import type { DestroyPlatformTenantDto } from './dto/destroy-tenant.dto';
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

    const rows = await Promise.all(
      orgs.map((org) => this.toTenantRow(org)),
    );

    const active = rows.filter((row) => row.status === 'ACTIVE');
    return {
      tenants: {
        total: rows.length,
        active: active.length,
        suspended: rows.length - active.length,
      },
      lives: {
        contracted: rows.reduce((sum, row) => sum + row.contractedLifeQuota, 0),
        allocated: rows.reduce((sum, row) => sum + row.allocatedLives, 0),
        used: rows.reduce((sum, row) => sum + row.usedLives, 0),
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
    if (!name || !ownerName || !ownerEmail) {
      throw new BadRequestException('Informe consultoria, gestor e e-mail.');
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

      return { organization, user, membership };
    });

    const accessUrl = this.resolveConsultoriaAccessUrl();
    const delivery = reuseUser
      ? {
          enabled: false,
          email: 'SKIPPED' as const,
          whatsapp: 'SKIPPED' as const,
        }
      : await this.communications.enqueueConsultoriaAccessInvite({
          organizationId: created.organization.id,
          recipientName: ownerName,
          recipientEmail: ownerEmail,
          recipientPhone: null,
          temporaryPassword: temporaryPassword as string,
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
        temporaryPassword: reuseUser
          ? null
          : delivery.enabled
            ? null
            : temporaryPassword,
        accessUrl,
        createdUser: !reuseUser,
        deliveryEnabled: delivery.enabled,
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
    return this.toTenantRow(org);
  }

  private async toTenantRow(org: {
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
  }) {
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
      owner: owner
        ? { id: owner.id, name: owner.name, email: owner.email }
        : null,
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
      process.env.CORS_ORIGIN?.split(',')[0]?.trim();
    const base = (fromEnv || 'http://localhost:3000').replace(/\/$/, '');
    if (base.endsWith('/login')) return base;
    return `${base}/login`;
  }
}
