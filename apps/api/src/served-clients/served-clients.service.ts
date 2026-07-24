import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ClientUserAccessStatus,
  ClientUserRole,
  Prisma,
  ServedClientStatus,
  WorkerStatus,
} from '@prisma/client';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { AuditService } from '../audit/audit.service';
import { validateCnpj } from '../common/cnpj';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateServedClientDto } from './dto/create-served-client.dto';
import type { UpdateServedClientDto } from './dto/update-served-client.dto';
import type {
  CreateClientUserDto,
  CreateInitialManagerDto,
  UpdateClientUserDto,
} from './dto/client-user.dto';

const REACTIVATE_QUOTA_ERROR =
  'Nao ha vidas disponiveis suficientes para reativar esta empresa.';

export const CLIENT_MANAGER_LIMIT = 2;
export const STOCK_OPERATOR_LIMIT = 4;

export type ClientInitialAccessPayload = {
  membershipId: string;
  managerName: string;
  managerEmail: string;
  managerPhone: string | null;
  temporaryPassword: string;
  accessUrl: string;
  accessStatus: ClientUserAccessStatus;
  warning: string;
};

@Injectable()
export class ServedClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(organizationId: string) {
    return this.prisma.servedClient.findMany({
      where: { organizationId },
      orderBy: [{ status: 'asc' }, { legalName: 'asc' }],
    });
  }

  async getById(organizationId: string, id: string) {
    const client = await this.prisma.servedClient.findFirst({
      where: { id, organizationId },
    });
    if (!client) {
      throw new NotFoundException('Cliente atendido nao encontrado.');
    }
    return client;
  }

  async getQuotaSummary(organizationId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { contractedLifeQuota: true },
    });
    if (!organization) {
      throw new NotFoundException('Organizacao nao encontrada.');
    }

    const [activeAggregate, inactiveAggregate, totalClients, used] =
      await Promise.all([
        this.prisma.servedClient.aggregate({
          where: { organizationId, status: ServedClientStatus.ACTIVE },
          _sum: { allocatedLifeQuota: true },
          _count: { _all: true },
        }),
        this.prisma.servedClient.aggregate({
          where: { organizationId, status: ServedClientStatus.INACTIVE },
          _sum: { allocatedLifeQuota: true },
        }),
        this.prisma.servedClient.count({
          where: { organizationId },
        }),
        this.prisma.worker.count({
          where: {
            organizationId,
            status: WorkerStatus.ACTIVE,
            servedClient: { status: ServedClientStatus.ACTIVE },
          },
        }),
      ]);

    const contracted = organization.contractedLifeQuota;
    const allocated = activeAggregate._sum.allocatedLifeQuota ?? 0;
    const inactiveAllocated = inactiveAggregate._sum.allocatedLifeQuota ?? 0;
    const available = Math.max(0, contracted - allocated);

    return {
      contracted,
      allocated,
      available,
      used,
      inactiveAllocated,
      activeClients: activeAggregate._count._all,
      totalClients,
    };
  }

  async create(
    organizationId: string,
    userId: string,
    dto: CreateServedClientDto,
  ) {
    const cnpj = this.normalizeAndValidateCnpj(dto.cnpj);
    const status = dto.status ?? ServedClientStatus.ACTIVE;

    if (status === ServedClientStatus.ACTIVE) {
      await this.assertQuotaFits(organizationId, dto.allocatedLifeQuota);
    } else if (dto.allocatedLifeQuota < 0) {
      throw new BadRequestException('A cota alocada nao pode ser negativa.');
    }

    await this.assertUniqueCnpj(organizationId, cnpj);

    const wantsManager =
      !!dto.initialManagerName?.trim() || !!dto.initialManagerEmail?.trim();
    if (wantsManager) {
      if (!dto.initialManagerName?.trim() || !dto.initialManagerEmail?.trim()) {
        throw new BadRequestException(
          'Para criar o gestor inicial, informe nome e e-mail.',
        );
      }
      if (status !== ServedClientStatus.ACTIVE) {
        throw new BadRequestException(
          'Gestor inicial so pode ser criado para cliente ativo.',
        );
      }
    }

    try {
      const client = await this.prisma.servedClient.create({
        data: {
          organizationId,
          legalName: dto.legalName.trim(),
          tradeName: dto.tradeName?.trim() || null,
          cnpj,
          allocatedLifeQuota: dto.allocatedLifeQuota,
          status,
          notes: dto.notes?.trim() || null,
        },
      });

      await this.audit.log({
        action: 'served_client.created',
        organizationId,
        userId,
        entityType: 'ServedClient',
        entityId: client.id,
        metadata: {
          cnpj: client.cnpj,
          allocatedLifeQuota: client.allocatedLifeQuota,
          status: client.status,
          withInitialManager: wantsManager,
        },
      });

      let initialAccess: ClientInitialAccessPayload | null = null;
      if (wantsManager) {
        initialAccess = await this.provisionInitialManager(
          organizationId,
          userId,
          client.id,
          {
            name: dto.initialManagerName!.trim(),
            email: dto.initialManagerEmail!.trim(),
            phone: dto.initialManagerPhone?.trim() || null,
          },
        );
      }

      return {
        client,
        initialAccess,
        servedClientId: client.id,
        ...(initialAccess
          ? {
              managerName: initialAccess.managerName,
              managerEmail: initialAccess.managerEmail,
              temporaryPassword: initialAccess.temporaryPassword,
              accessUrl: initialAccess.accessUrl,
              warning: initialAccess.warning,
            }
          : {}),
      };
    } catch (error) {
      this.rethrowUniqueConflict(error);
      throw error;
    }
  }

  async createInitialManager(
    organizationId: string,
    actorUserId: string,
    servedClientId: string,
    dto: CreateInitialManagerDto,
  ) {
    const client = await this.getById(organizationId, servedClientId);
    this.assertClientOperational(client.status);
    return this.provisionInitialManager(organizationId, actorUserId, client.id, {
      name: dto.name.trim(),
      email: dto.email.trim(),
      phone: dto.phone?.trim() || null,
    });
  }

  async resetClientUserAccess(
    organizationId: string,
    actorUserId: string,
    servedClientId: string,
    membershipId: string,
  ) {
    const client = await this.getById(organizationId, servedClientId);
    this.assertClientOperational(client.status);
    const membership = await this.getClientUserMembership(
      organizationId,
      servedClientId,
      membershipId,
    );
    if (!membership.isActive) {
      throw new BadRequestException(
        'Reative o usuario antes de redefinir o acesso.',
      );
    }
    if (membership.role === ClientUserRole.WORKER) {
      throw new BadRequestException(
        'Usuario trabalhador ainda nao esta disponivel nesta etapa.',
      );
    }

    const temporaryPassword = this.generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);
    const email = membership.email.toLowerCase();

    const user = await this.ensureUserForClientAccess({
      email,
      name: membership.name,
      passwordHash,
    });

    const updated = await this.prisma.clientUserMembership.update({
      where: { id: membership.id },
      data: {
        userId: user.id,
        accessStatus: ClientUserAccessStatus.INVITED,
        mustChangePassword: true,
        temporaryPasswordCreatedAt: new Date(),
        isActive: true,
      },
    });

    await this.audit.log({
      action: 'client_user.access_reset',
      organizationId,
      userId: actorUserId,
      entityType: 'ClientUserMembership',
      entityId: updated.id,
      metadata: {
        servedClientId,
        email,
        role: updated.role,
        // nunca logar senha
      },
    });

    return this.toInitialAccessPayload(updated, temporaryPassword);
  }

  private async provisionInitialManager(
    organizationId: string,
    actorUserId: string,
    servedClientId: string,
    input: { name: string; email: string; phone: string | null },
  ): Promise<ClientInitialAccessPayload> {
    const email = input.email.trim().toLowerCase();
    const name = input.name.trim();
    if (!email || !name) {
      throw new BadRequestException('Nome e e-mail do gestor sao obrigatorios.');
    }

    await this.assertClientUserRoleLimit(
      organizationId,
      servedClientId,
      ClientUserRole.CLIENT_MANAGER,
    );

    const duplicate = await this.prisma.clientUserMembership.findFirst({
      where: { servedClientId, email },
    });
    if (duplicate) {
      throw new ConflictException(
        'Ja existe um usuario operacional com este e-mail neste cliente.',
      );
    }

    const temporaryPassword = this.generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);
    const user = await this.ensureUserForClientAccess({
      email,
      name,
      passwordHash,
    });

    const membership = await this.prisma.clientUserMembership.create({
      data: {
        organizationId,
        servedClientId,
        userId: user.id,
        email,
        name,
        phone: input.phone,
        role: ClientUserRole.CLIENT_MANAGER,
        isActive: true,
        accessStatus: ClientUserAccessStatus.INVITED,
        mustChangePassword: true,
        temporaryPasswordCreatedAt: new Date(),
      },
    });

    await this.audit.log({
      action: 'client_user.initial_manager_created',
      organizationId,
      userId: actorUserId,
      entityType: 'ClientUserMembership',
      entityId: membership.id,
      metadata: {
        servedClientId,
        email,
        role: membership.role,
        accessStatus: membership.accessStatus,
      },
    });

    return this.toInitialAccessPayload(membership, temporaryPassword);
  }

  private async ensureUserForClientAccess(input: {
    email: string;
    name: string;
    passwordHash: string;
  }) {
    const existing = await this.prisma.user.findUnique({
      where: { email: input.email },
      include: { _count: { select: { memberships: true } } },
    });
    if (existing) {
      if (existing._count.memberships > 0) {
        throw new ConflictException(
          'Este e-mail ja pertence a um usuario da consultoria. Use outro e-mail para o gestor do cliente.',
        );
      }
      return this.prisma.user.update({
        where: { id: existing.id },
        data: {
          name: input.name,
          passwordHash: input.passwordHash,
        },
      });
    }
    return this.prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash: input.passwordHash,
      },
    });
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

  private resolveAccessUrl(): string {
    const fromEnv =
      process.env.CLIENT_PORTAL_URL?.trim() ||
      process.env.WEB_APP_URL?.trim() ||
      process.env.CORS_ORIGIN?.split(',')[0]?.trim();
    const base = (fromEnv || 'http://localhost:3000').replace(/\/$/, '');
    if (base.endsWith('/portal/login') || base.endsWith('/portal')) {
      return base.includes('/login') ? base : `${base}/login`;
    }
    return `${base}/portal/login`;
  }

  private toInitialAccessPayload(
    membership: {
      id: string;
      name: string;
      email: string;
      phone: string | null;
      accessStatus: ClientUserAccessStatus;
    },
    temporaryPassword: string,
  ): ClientInitialAccessPayload {
    return {
      membershipId: membership.id,
      managerName: membership.name,
      managerEmail: membership.email,
      managerPhone: membership.phone,
      temporaryPassword,
      accessUrl: this.resolveAccessUrl(),
      accessStatus: membership.accessStatus,
      warning:
        'A senha temporaria sera exibida apenas agora. Use o link do portal do cliente (/portal/login), nao o login da Consultoria. Envio por WhatsApp/e-mail sera implementado depois.',
    };
  }

  async update(
    organizationId: string,
    userId: string,
    id: string,
    dto: UpdateServedClientDto,
  ) {
    const existing = await this.getById(organizationId, id);
    const cnpj =
      dto.cnpj !== undefined
        ? this.normalizeAndValidateCnpj(dto.cnpj)
        : existing.cnpj;

    if (cnpj !== existing.cnpj) {
      await this.assertUniqueCnpj(organizationId, cnpj, id);
    }

    const nextStatus = dto.status ?? existing.status;
    const nextQuota =
      dto.allocatedLifeQuota !== undefined
        ? dto.allocatedLifeQuota
        : existing.allocatedLifeQuota;
    const willBeActive = nextStatus === ServedClientStatus.ACTIVE;
    const becomingActive =
      existing.status !== ServedClientStatus.ACTIVE && willBeActive;

    if (becomingActive) {
      await this.assertCanConsumeQuota(
        organizationId,
        nextQuota,
        id,
        REACTIVATE_QUOTA_ERROR,
      );
    } else if (willBeActive && dto.allocatedLifeQuota !== undefined) {
      await this.assertQuotaFits(organizationId, nextQuota, id);
    } else if (
      dto.allocatedLifeQuota !== undefined &&
      dto.allocatedLifeQuota < 0
    ) {
      throw new BadRequestException('A cota alocada nao pode ser negativa.');
    }

    if (dto.allocatedLifeQuota !== undefined) {
      await this.assertQuotaNotBelowActiveWorkers(
        organizationId,
        id,
        dto.allocatedLifeQuota,
      );
    }

    try {
      const client = await this.prisma.servedClient.update({
        where: { id },
        data: {
          legalName: dto.legalName?.trim(),
          tradeName:
            dto.tradeName === undefined
              ? undefined
              : dto.tradeName?.trim() || null,
          cnpj: dto.cnpj !== undefined ? cnpj : undefined,
          allocatedLifeQuota: dto.allocatedLifeQuota,
          status: dto.status,
          notes:
            dto.notes === undefined ? undefined : dto.notes?.trim() || null,
        },
      });

      await this.audit.log({
        action: 'served_client.updated',
        organizationId,
        userId,
        entityType: 'ServedClient',
        entityId: client.id,
        metadata: {
          before: {
            legalName: existing.legalName,
            cnpj: existing.cnpj,
            allocatedLifeQuota: existing.allocatedLifeQuota,
            status: existing.status,
          },
          after: {
            legalName: client.legalName,
            cnpj: client.cnpj,
            allocatedLifeQuota: client.allocatedLifeQuota,
            status: client.status,
          },
        },
      });

      return client;
    } catch (error) {
      this.rethrowUniqueConflict(error);
      throw error;
    }
  }

  async updateStatus(
    organizationId: string,
    userId: string,
    id: string,
    status: ServedClientStatus,
  ) {
    const existing = await this.getById(organizationId, id);
    if (existing.status === status) {
      return existing;
    }

    if (status === ServedClientStatus.ACTIVE) {
      await this.assertCanConsumeQuota(
        organizationId,
        existing.allocatedLifeQuota,
        id,
        REACTIVATE_QUOTA_ERROR,
      );
    }

    const client = await this.prisma.servedClient.update({
      where: { id },
      data: { status },
    });

    await this.audit.log({
      action: 'served_client.status_changed',
      organizationId,
      userId,
      entityType: 'ServedClient',
      entityId: client.id,
      metadata: {
        from: existing.status,
        to: client.status,
        allocatedLifeQuota: client.allocatedLifeQuota,
        quotaReleased: status === ServedClientStatus.INACTIVE,
        quotaConsumed: status === ServedClientStatus.ACTIVE,
      },
    });

    return client;
  }

  async getOverview(organizationId: string, id: string) {
    const client = await this.getById(organizationId, id);

    const [
      unitsTotal,
      unitsActive,
      workersActive,
      workersTotal,
      sectorsActive,
      sectorsTotal,
      jobsActive,
      jobsTotal,
      riskLinks,
      epiRequirements,
      epiNeedsActive,
      epiItemsActive,
      stockAgg,
      stockZero,
      lastPgro,
      managersActive,
      managersTotal,
      stockOpsActive,
      stockOpsTotal,
    ] = await Promise.all([
      this.prisma.operationalUnit.count({
        where: { organizationId, servedClientId: id },
      }),
      this.prisma.operationalUnit.count({
        where: {
          organizationId,
          servedClientId: id,
          status: 'ACTIVE',
        },
      }),
      this.prisma.worker.count({
        where: {
          organizationId,
          servedClientId: id,
          status: WorkerStatus.ACTIVE,
        },
      }),
      this.prisma.worker.count({
        where: { organizationId, servedClientId: id },
      }),
      this.prisma.clientSector.count({
        where: { organizationId, servedClientId: id, isActive: true },
      }),
      this.prisma.clientSector.count({
        where: { organizationId, servedClientId: id },
      }),
      this.prisma.clientJobFunction.count({
        where: { organizationId, servedClientId: id, isActive: true },
      }),
      this.prisma.clientJobFunction.count({
        where: { organizationId, servedClientId: id },
      }),
      this.prisma.jobFunctionRisk.count({
        where: {
          organizationId,
          jobFunction: { servedClientId: id },
        },
      }),
      this.prisma.jobFunctionEpiRequirement.count({
        where: {
          organizationId,
          jobFunction: { servedClientId: id },
          isActive: true,
        },
      }),
      this.prisma.epiNeed.count({
        where: { organizationId, isActive: true },
      }),
      this.prisma.epiItem.count({
        where: { organizationId, isActive: true },
      }),
      this.prisma.epiStockBalance.aggregate({
        where: { organizationId },
        _sum: { quantity: true },
        _count: { _all: true },
      }),
      this.prisma.epiStockBalance.count({
        where: { organizationId, quantity: { lte: 0 } },
      }),
      this.prisma.pgroImportRun.findFirst({
        where: { organizationId, servedClientId: id },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          fileName: true,
          status: true,
          createdAt: true,
          finishedAt: true,
        },
      }),
      this.prisma.clientUserMembership.count({
        where: {
          organizationId,
          servedClientId: id,
          role: ClientUserRole.CLIENT_MANAGER,
          isActive: true,
        },
      }),
      this.prisma.clientUserMembership.count({
        where: {
          organizationId,
          servedClientId: id,
          role: ClientUserRole.CLIENT_MANAGER,
        },
      }),
      this.prisma.clientUserMembership.count({
        where: {
          organizationId,
          servedClientId: id,
          role: ClientUserRole.STOCK_OPERATOR,
          isActive: true,
        },
      }),
      this.prisma.clientUserMembership.count({
        where: {
          organizationId,
          servedClientId: id,
          role: ClientUserRole.STOCK_OPERATOR,
        },
      }),
    ]);

    const lowBalances = await this.prisma.epiStockBalance.findMany({
      where: { organizationId, quantity: { gt: 0 }, minQuantity: { not: null } },
      select: { quantity: true, minQuantity: true },
    });
    const stockLowCount = lowBalances.filter(
      (b) => b.minQuantity != null && b.quantity <= b.minQuantity,
    ).length;

    return {
      client,
      operational: client.status === ServedClientStatus.ACTIVE,
      lives: {
        allocated: client.allocatedLifeQuota,
        used: workersActive,
        available: Math.max(0, client.allocatedLifeQuota - workersActive),
        note: 'Vidas representam trabalhadores ativos. Gestores e operadores de estoque nao consomem vidas.',
      },
      counts: {
        units: { active: unitsActive, total: unitsTotal },
        workers: { active: workersActive, total: workersTotal },
        sectors: { active: sectorsActive, total: sectorsTotal },
        jobFunctions: { active: jobsActive, total: jobsTotal },
        riskLinks,
        epiRequirements,
        epiNeeds: {
          active: epiNeedsActive,
          scopedToClient: false,
          note: 'Necessidades ainda sao catalogo do tenant; escopo por cliente em etapa futura.',
        },
        epiItems: {
          active: epiItemsActive,
          scopedToClient: false,
          note: 'EPIs reais ainda sao catalogo do tenant; operacao por cliente em etapa futura.',
        },
        stock: {
          balanceRows: stockAgg._count._all,
          totalQuantity: stockAgg._sum.quantity ?? 0,
          low: stockLowCount,
          zero: stockZero,
          scopedToClient: false,
          note: 'Estoque ainda e do tenant; escopo por cliente em etapa futura.',
        },
        users: {
          managers: {
            active: managersActive,
            total: managersTotal,
            limit: CLIENT_MANAGER_LIMIT,
          },
          stockOperators: {
            active: stockOpsActive,
            total: stockOpsTotal,
            limit: STOCK_OPERATOR_LIMIT,
          },
        },
      },
      lastPgroImport: lastPgro
        ? {
            id: lastPgro.id,
            fileName: lastPgro.fileName,
            status: lastPgro.status,
            createdAt: lastPgro.createdAt,
            finishedAt: lastPgro.finishedAt,
          }
        : null,
    };
  }

  async listClientUsers(organizationId: string, servedClientId: string) {
    await this.getById(organizationId, servedClientId);
    return this.prisma.clientUserMembership.findMany({
      where: { organizationId, servedClientId },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });
  }

  async createClientUser(
    organizationId: string,
    actorUserId: string,
    servedClientId: string,
    dto: CreateClientUserDto,
  ) {
    const client = await this.getById(organizationId, servedClientId);
    this.assertClientOperational(client.status);

    const role = dto.role;
    if (role === ClientUserRole.WORKER) {
      throw new BadRequestException(
        'Usuario trabalhador ainda nao esta disponivel nesta etapa.',
      );
    }

    const email = dto.email.trim().toLowerCase();
    const name = dto.name.trim();
    if (!email || !name) {
      throw new BadRequestException('Nome e e-mail sao obrigatorios.');
    }

    await this.assertClientUserRoleLimit(organizationId, servedClientId, role);

    const duplicate = await this.prisma.clientUserMembership.findFirst({
      where: { servedClientId, email },
    });
    if (duplicate) {
      throw new ConflictException(
        'Ja existe um usuario operacional com este e-mail neste cliente.',
      );
    }

    try {
      const membership = await this.prisma.clientUserMembership.create({
        data: {
          organizationId,
          servedClientId,
          email,
          name,
          role,
          isActive: true,
          accessStatus: ClientUserAccessStatus.PREPARED,
          userId: null,
          phone: dto.phone?.trim() || null,
        },
      });

      await this.audit.log({
        action: 'client_user.created',
        organizationId,
        userId: actorUserId,
        entityType: 'ClientUserMembership',
        entityId: membership.id,
        metadata: {
          servedClientId,
          email,
          role,
          accessStatus: membership.accessStatus,
        },
      });

      return membership;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Ja existe um usuario operacional com este e-mail neste cliente.',
        );
      }
      throw error;
    }
  }

  async updateClientUser(
    organizationId: string,
    actorUserId: string,
    servedClientId: string,
    membershipId: string,
    dto: UpdateClientUserDto,
  ) {
    const client = await this.getById(organizationId, servedClientId);
    this.assertClientOperational(client.status);

    const existing = await this.getClientUserMembership(
      organizationId,
      servedClientId,
      membershipId,
    );

    const nextRole = dto.role ?? existing.role;
    if (nextRole === ClientUserRole.WORKER) {
      throw new BadRequestException(
        'Usuario trabalhador ainda nao esta disponivel nesta etapa.',
      );
    }

    if (dto.role && dto.role !== existing.role && existing.isActive) {
      await this.assertClientUserRoleLimit(
        organizationId,
        servedClientId,
        dto.role,
        membershipId,
      );
    }

    const nextEmail =
      dto.email !== undefined ? dto.email.trim().toLowerCase() : existing.email;
    if (dto.email !== undefined && nextEmail !== existing.email) {
      const duplicate = await this.prisma.clientUserMembership.findFirst({
        where: {
          servedClientId,
          email: nextEmail,
          NOT: { id: membershipId },
        },
      });
      if (duplicate) {
        throw new ConflictException(
          'Ja existe um usuario operacional com este e-mail neste cliente.',
        );
      }
    }

    const membership = await this.prisma.clientUserMembership.update({
      where: { id: membershipId },
      data: {
        name: dto.name?.trim(),
        email: dto.email !== undefined ? nextEmail : undefined,
        role: dto.role,
        phone:
          dto.phone !== undefined
            ? dto.phone?.trim() || null
            : undefined,
      },
    });

    await this.audit.log({
      action: 'client_user.updated',
      organizationId,
      userId: actorUserId,
      entityType: 'ClientUserMembership',
      entityId: membership.id,
      metadata: {
        servedClientId,
        before: {
          name: existing.name,
          email: existing.email,
          role: existing.role,
        },
        after: {
          name: membership.name,
          email: membership.email,
          role: membership.role,
        },
      },
    });

    return membership;
  }

  async updateClientUserStatus(
    organizationId: string,
    actorUserId: string,
    servedClientId: string,
    membershipId: string,
    isActive: boolean,
  ) {
    await this.getById(organizationId, servedClientId);
    const existing = await this.getClientUserMembership(
      organizationId,
      servedClientId,
      membershipId,
    );

    if (existing.isActive === isActive) {
      return existing;
    }

    if (isActive) {
      const client = await this.getById(organizationId, servedClientId);
      this.assertClientOperational(client.status);
      await this.assertClientUserRoleLimit(
        organizationId,
        servedClientId,
        existing.role,
        membershipId,
      );
    }

    const membership = await this.prisma.clientUserMembership.update({
      where: { id: membershipId },
      data: {
        isActive,
        accessStatus: isActive
          ? existing.userId
            ? ClientUserAccessStatus.INVITED
            : ClientUserAccessStatus.PREPARED
          : ClientUserAccessStatus.DISABLED,
      },
    });

    await this.audit.log({
      action: 'client_user.status_changed',
      organizationId,
      userId: actorUserId,
      entityType: 'ClientUserMembership',
      entityId: membership.id,
      metadata: {
        servedClientId,
        from: existing.isActive,
        to: membership.isActive,
        role: membership.role,
      },
    });

    return membership;
  }

  private assertClientOperational(status: ServedClientStatus) {
    if (status !== ServedClientStatus.ACTIVE) {
      throw new BadRequestException(
        'Cliente inativo: operacao diaria e gestao de usuarios bloqueadas.',
      );
    }
  }

  private async getClientUserMembership(
    organizationId: string,
    servedClientId: string,
    membershipId: string,
  ) {
    const membership = await this.prisma.clientUserMembership.findFirst({
      where: { id: membershipId, organizationId, servedClientId },
    });
    if (!membership) {
      throw new NotFoundException('Usuario do cliente nao encontrado.');
    }
    return membership;
  }

  private async assertClientUserRoleLimit(
    organizationId: string,
    servedClientId: string,
    role: ClientUserRole,
    excludeId?: string,
  ) {
    const limit =
      role === ClientUserRole.CLIENT_MANAGER
        ? CLIENT_MANAGER_LIMIT
        : role === ClientUserRole.STOCK_OPERATOR
          ? STOCK_OPERATOR_LIMIT
          : null;
    if (limit == null) return;

    const activeCount = await this.prisma.clientUserMembership.count({
      where: {
        organizationId,
        servedClientId,
        role,
        isActive: true,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });

    if (activeCount >= limit) {
      const label =
        role === ClientUserRole.CLIENT_MANAGER
          ? 'gestores do cliente'
          : 'operadores de estoque';
      throw new BadRequestException(
        `Limite de ${limit} ${label} ativos atingido neste cliente.`,
      );
    }
  }

  private normalizeAndValidateCnpj(value: string): string {
    const result = validateCnpj(value);
    if (!result.ok) {
      throw new BadRequestException(result.message);
    }
    return result.normalized;
  }

  private async assertUniqueCnpj(
    organizationId: string,
    cnpj: string,
    excludeId?: string,
  ) {
    const existing = await this.prisma.servedClient.findFirst({
      where: {
        organizationId,
        cnpj,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'Ja existe um cliente atendido com este CNPJ nesta organizacao.',
      );
    }
  }

  /**
   * Soma apenas cotas de clientes ACTIVE (empresas inativas nao consomem franquia).
   */
  private async assertQuotaFits(
    organizationId: string,
    nextQuota: number,
    excludeId?: string,
  ) {
    if (nextQuota < 0) {
      throw new BadRequestException('A cota alocada nao pode ser negativa.');
    }

    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { contractedLifeQuota: true },
    });
    if (!organization) {
      throw new NotFoundException('Organizacao nao encontrada.');
    }

    const aggregate = await this.prisma.servedClient.aggregate({
      where: {
        organizationId,
        status: ServedClientStatus.ACTIVE,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      _sum: { allocatedLifeQuota: true },
    });

    const otherAllocated = aggregate._sum.allocatedLifeQuota ?? 0;
    const total = otherAllocated + nextQuota;

    if (total > organization.contractedLifeQuota) {
      const available = Math.max(
        0,
        organization.contractedLifeQuota - otherAllocated,
      );
      throw new BadRequestException(
        `A soma das cotas ultrapassa a franquia contratada (${organization.contractedLifeQuota} vidas). Disponivel para este cliente: ${available}.`,
      );
    }
  }

  private async assertCanConsumeQuota(
    organizationId: string,
    nextQuota: number,
    excludeId: string,
    errorMessage: string,
  ) {
    if (nextQuota < 0) {
      throw new BadRequestException('A cota alocada nao pode ser negativa.');
    }

    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { contractedLifeQuota: true },
    });
    if (!organization) {
      throw new NotFoundException('Organizacao nao encontrada.');
    }

    const aggregate = await this.prisma.servedClient.aggregate({
      where: {
        organizationId,
        status: ServedClientStatus.ACTIVE,
        NOT: { id: excludeId },
      },
      _sum: { allocatedLifeQuota: true },
    });

    const otherAllocated = aggregate._sum.allocatedLifeQuota ?? 0;
    const available = Math.max(
      0,
      organization.contractedLifeQuota - otherAllocated,
    );

    if (nextQuota > available) {
      throw new BadRequestException(errorMessage);
    }
  }

  private async assertQuotaNotBelowActiveWorkers(
    organizationId: string,
    servedClientId: string,
    nextQuota: number,
  ) {
    const activeWorkers = await this.prisma.worker.count({
      where: {
        organizationId,
        servedClientId,
        status: WorkerStatus.ACTIVE,
      },
    });

    if (nextQuota < activeWorkers) {
      throw new BadRequestException(
        'A nova cota nao pode ser menor que as vidas ativas ja cadastradas neste cliente.',
      );
    }
  }

  private rethrowUniqueConflict(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'Ja existe um cliente atendido com este CNPJ nesta organizacao.',
      );
    }
  }
}
