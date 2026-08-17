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
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { ServedClientsService } from '../served-clients/served-clients.service';
import type {
  CreateClientGroupDto,
  GrantClientGroupAccessDto,
  SetClientGroupMembersDto,
  UpdateClientGroupDto,
} from './dto/client-group.dto';

@Injectable()
export class ClientGroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly servedClients: ServedClientsService,
  ) {}

  async list(organizationId: string) {
    const rows = await this.prisma.clientGroup.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
      include: {
        members: {
          include: {
            servedClient: {
              select: {
                id: true,
                legalName: true,
                tradeName: true,
                cnpj: true,
                status: true,
              },
            },
          },
          orderBy: { servedClient: { legalName: 'asc' } },
        },
      },
    });
    return rows.map((row) => this.toGroup(row));
  }

  async getById(organizationId: string, id: string) {
    const row = await this.prisma.clientGroup.findFirst({
      where: { id, organizationId },
      include: {
        members: {
          include: {
            servedClient: {
              select: {
                id: true,
                legalName: true,
                tradeName: true,
                cnpj: true,
                status: true,
              },
            },
          },
          orderBy: { servedClient: { legalName: 'asc' } },
        },
      },
    });
    if (!row) {
      throw new NotFoundException('Grupo nao encontrado.');
    }
    const people = await this.listPeople(organizationId, row.members.map((m) => m.servedClientId));
    return { ...this.toGroup(row), people };
  }

  async create(
    organizationId: string,
    actorUserId: string,
    dto: CreateClientGroupDto,
  ) {
    const name = dto.name.trim();
    if (name.length < 2) {
      throw new BadRequestException('Informe o nome do grupo.');
    }
    try {
      const group = await this.prisma.clientGroup.create({
        data: {
          organizationId,
          name,
          notes: dto.notes?.trim() || null,
        },
        include: { members: { include: { servedClient: true } } },
      });
      await this.audit.log({
        action: 'client_group.created',
        organizationId,
        userId: actorUserId,
        entityType: 'ClientGroup',
        entityId: group.id,
        metadata: { name: group.name },
      });
      return this.toGroup(group);
    } catch (error) {
      this.throwUnique(error);
      throw error;
    }
  }

  async update(
    organizationId: string,
    actorUserId: string,
    id: string,
    dto: UpdateClientGroupDto,
  ) {
    await this.assertGroup(organizationId, id);
    try {
      const group = await this.prisma.clientGroup.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          notes:
            dto.notes !== undefined ? dto.notes?.trim() || null : undefined,
        },
        include: {
          members: { include: { servedClient: true } },
        },
      });
      await this.audit.log({
        action: 'client_group.updated',
        organizationId,
        userId: actorUserId,
        entityType: 'ClientGroup',
        entityId: group.id,
        metadata: { name: group.name },
      });
      return this.toGroup(group);
    } catch (error) {
      this.throwUnique(error);
      throw error;
    }
  }

  async remove(organizationId: string, actorUserId: string, id: string) {
    const group = await this.assertGroup(organizationId, id);
    await this.prisma.clientGroup.delete({ where: { id } });
    await this.audit.log({
      action: 'client_group.deleted',
      organizationId,
      userId: actorUserId,
      entityType: 'ClientGroup',
      entityId: id,
      metadata: { name: group.name },
    });
    return { ok: true as const };
  }

  async setMembers(
    organizationId: string,
    actorUserId: string,
    id: string,
    dto: SetClientGroupMembersDto,
  ) {
    const group = await this.assertGroup(organizationId, id);
    const ids = [...new Set(dto.servedClientIds.map((item) => item.trim()).filter(Boolean))];
    const clients = await this.prisma.servedClient.findMany({
      where: { organizationId, id: { in: ids } },
      select: { id: true },
    });
    if (clients.length !== ids.length) {
      throw new BadRequestException(
        'Um ou mais CNPJs nao pertencem a esta consultoria.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.clientGroupMember.deleteMany({
        where: { servedClientId: { in: ids }, NOT: { groupId: id } },
      });
      await tx.clientGroupMember.deleteMany({
        where: { groupId: id, servedClientId: { notIn: ids } },
      });
      for (const servedClientId of ids) {
        await tx.clientGroupMember.upsert({
          where: { servedClientId },
          create: { organizationId, groupId: id, servedClientId },
          update: { groupId: id },
        });
      }
    });

    await this.audit.log({
      action: 'client_group.members_set',
      organizationId,
      userId: actorUserId,
      entityType: 'ClientGroup',
      entityId: id,
      metadata: { name: group.name, servedClientIds: ids },
    });
    return this.getById(organizationId, id);
  }

  async grantAccess(
    organizationId: string,
    actorUserId: string,
    id: string,
    dto: GrantClientGroupAccessDto,
  ) {
    if (dto.role === ClientUserRole.WORKER) {
      throw new BadRequestException(
        'Usuario trabalhador ainda nao esta disponivel nesta etapa.',
      );
    }
    const group = await this.getById(organizationId, id);
    const allowed = new Set(group.clients.map((c) => c.id));
    const servedClientIds = [...new Set(dto.servedClientIds)];
    if (servedClientIds.some((clientId) => !allowed.has(clientId))) {
      throw new BadRequestException(
        'So e possivel liberar CNPJs que ja estao neste grupo.',
      );
    }

    const email = dto.email.trim().toLowerCase();
    const name = dto.name.trim();
    const phone = dto.phone?.trim() || null;

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      include: { _count: { select: { memberships: true } } },
    });
    if (existingUser && existingUser._count.memberships > 0) {
      throw new ConflictException(
        'Este e-mail ja pertence a um usuario da consultoria. Use outro e-mail para o gestor do cliente.',
      );
    }

    let created = 0;
    let alreadyHadAccess = 0;
    let firstNew: { id: string; servedClientId: string } | null = null;

    for (const servedClientId of servedClientIds) {
      const existing = await this.prisma.clientUserMembership.findFirst({
        where: { servedClientId, email },
      });
      if (existing) {
        alreadyHadAccess += 1;
        continue;
      }
      const membership = await this.servedClients.createClientUser(
        organizationId,
        actorUserId,
        servedClientId,
        { name, email, role: dto.role, phone },
      );
      if (!firstNew) {
        firstNew = { id: membership.id, servedClientId };
      }
      created += 1;
    }

    let initialAccess = null;
    let invited = false;

    if (existingUser) {
      await this.prisma.clientUserMembership.updateMany({
        where: {
          email,
          servedClientId: { in: servedClientIds },
          userId: null,
        },
        data: {
          userId: existingUser.id,
          accessStatus: ClientUserAccessStatus.ACTIVE,
        },
      });
    } else if (firstNew) {
      initialAccess = await this.servedClients.resetClientUserAccess(
        organizationId,
        actorUserId,
        firstNew.servedClientId,
        firstNew.id,
      );
      invited = true;
      const user = await this.prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });
      if (user) {
        await this.prisma.clientUserMembership.updateMany({
          where: {
            email,
            servedClientId: { in: servedClientIds },
            id: { not: firstNew.id },
            userId: null,
          },
          data: {
            userId: user.id,
            accessStatus: ClientUserAccessStatus.INVITED,
            mustChangePassword: true,
          },
        });
      }
    }

    await this.audit.log({
      action: 'client_group.access_granted',
      organizationId,
      userId: actorUserId,
      entityType: 'ClientGroup',
      entityId: id,
      metadata: {
        email,
        role: dto.role,
        servedClientIds,
        created,
        alreadyHadAccess,
        invited,
      },
    });

    return { created, alreadyHadAccess, invited, initialAccess };
  }

  private async listPeople(organizationId: string, servedClientIds: string[]) {
    if (servedClientIds.length === 0) return [];
    const rows = await this.prisma.clientUserMembership.findMany({
      where: {
        organizationId,
        servedClientId: { in: servedClientIds },
        role: {
          in: [ClientUserRole.CLIENT_MANAGER, ClientUserRole.STOCK_OPERATOR],
        },
      },
      include: {
        servedClient: {
          select: {
            id: true,
            legalName: true,
            tradeName: true,
            cnpj: true,
          },
        },
      },
      orderBy: [{ name: 'asc' }, { email: 'asc' }],
    });
    const byEmail = new Map<
      string,
      {
        email: string;
        name: string;
        role: ClientUserRole;
        isActive: boolean;
        clients: Array<{
          id: string;
          legalName: string;
          tradeName: string | null;
          cnpj: string;
        }>;
      }
    >();
    for (const row of rows) {
      const current = byEmail.get(row.email) ?? {
        email: row.email,
        name: row.name,
        role: row.role,
        isActive: row.isActive,
        clients: [],
      };
      current.clients.push(row.servedClient);
      if (!row.isActive) current.isActive = false;
      byEmail.set(row.email, current);
    }
    return [...byEmail.values()];
  }

  private async assertGroup(organizationId: string, id: string) {
    const group = await this.prisma.clientGroup.findFirst({
      where: { id, organizationId },
      select: { id: true, name: true },
    });
    if (!group) {
      throw new NotFoundException('Grupo nao encontrado.');
    }
    return group;
  }

  private toGroup(row: {
    id: string;
    organizationId: string;
    name: string;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
    members: Array<{
      servedClient: {
        id: string;
        legalName: string;
        tradeName: string | null;
        cnpj: string;
        status: ServedClientStatus;
      };
    }>;
  }) {
    return {
      id: row.id,
      organizationId: row.organizationId,
      name: row.name,
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      clients: row.members.map((m) => m.servedClient),
    };
  }

  private throwUnique(error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('Ja existe um grupo com este nome.');
    }
  }
}
