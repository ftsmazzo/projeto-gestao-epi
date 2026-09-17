import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  SupportLifecycleStatus,
  SupportMessageRole,
  SupportThreadStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type {
  PlatformSupportListQueryDto,
  PlatformSupportMessagesQueryDto,
} from './dto/platform-support.dto';

@Injectable()
export class PlatformSupportService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [
      all,
      waitingHuman,
      inProgress,
      resolved,
      activeAi,
      messagesLast24Hours,
      responseMetric,
      oldestWaiting,
      byScopeRaw,
      byOrganizationRaw,
    ] = await Promise.all([
      this.prisma.supportThread.count(),
      this.prisma.supportThread.count({
        where: { lifecycleStatus: SupportLifecycleStatus.WAITING_HUMAN },
      }),
      this.prisma.supportThread.count({
        where: { lifecycleStatus: SupportLifecycleStatus.IN_PROGRESS },
      }),
      this.prisma.supportThread.count({
        where: { lifecycleStatus: SupportLifecycleStatus.RESOLVED },
      }),
      this.prisma.supportThread.count({
        where: {
          lifecycleStatus: SupportLifecycleStatus.ACTIVE,
          status: SupportThreadStatus.AI,
        },
      }),
      this.prisma.supportMessage.count({
        where: { createdAt: { gte: since } },
      }),
      this.prisma.$queryRaw<Array<{ averageMinutes: number | null }>>`
        SELECT AVG(EXTRACT(EPOCH FROM ("firstHumanResponseAt" - "humanRequestedAt")) / 60)::float AS "averageMinutes"
        FROM "SupportThread"
        WHERE "humanRequestedAt" IS NOT NULL
          AND "firstHumanResponseAt" IS NOT NULL
          AND "firstHumanResponseAt" >= "humanRequestedAt"
      `,
      this.prisma.supportThread.findFirst({
        where: { lifecycleStatus: SupportLifecycleStatus.WAITING_HUMAN },
        orderBy: { humanRequestedAt: 'asc' },
        select: { humanRequestedAt: true },
      }),
      this.prisma.supportThread.groupBy({
        by: ['scope'],
        _count: { _all: true },
      }),
      this.prisma.supportThread.groupBy({
        by: ['organizationId'],
        where: {
          lifecycleStatus: {
            in: [
              SupportLifecycleStatus.WAITING_HUMAN,
              SupportLifecycleStatus.IN_PROGRESS,
            ],
          },
        },
        _count: { _all: true },
        orderBy: { _count: { organizationId: 'desc' } },
        take: 8,
      }),
    ]);

    const organizationIds = byOrganizationRaw.map((row) => row.organizationId);
    const organizations = organizationIds.length
      ? await this.prisma.organization.findMany({
          where: { id: { in: organizationIds } },
          select: { id: true, name: true },
        })
      : [];
    const organizationNames = new Map(
      organizations.map((organization) => [organization.id, organization.name]),
    );
    return {
      totals: {
        all,
        waitingHuman,
        inProgress,
        resolved,
        activeAi,
        messagesLast24Hours,
      },
      performance: {
        averageFirstResponseMinutes:
          responseMetric[0]?.averageMinutes == null
            ? null
            : Math.round(responseMetric[0].averageMinutes),
        oldestWaitingMinutes: oldestWaiting?.humanRequestedAt
          ? Math.max(
              0,
              Math.round(
                (Date.now() - oldestWaiting.humanRequestedAt.getTime()) / 60000,
              ),
            )
          : null,
      },
      byScope: byScopeRaw.map((row) => ({
        scope: row.scope,
        count: row._count._all,
      })),
      byOrganization: byOrganizationRaw.map((row) => ({
        organizationId: row.organizationId,
        organizationName:
          organizationNames.get(row.organizationId) || 'Consultoria removida',
        count: row._count._all,
      })),
    };
  }

  async list(query: PlatformSupportListQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 30;
    const where: Prisma.SupportThreadWhereInput = {
      ...(query.status ? { lifecycleStatus: query.status } : {}),
      ...(query.scope ? { scope: query.scope } : {}),
      ...(query.organizationId
        ? { organizationId: query.organizationId }
        : {}),
      ...(query.q?.trim()
        ? {
            OR: [
              {
                organization: {
                  name: { contains: query.q.trim(), mode: 'insensitive' },
                },
              },
              {
                servedClient: {
                  OR: [
                    {
                      legalName: {
                        contains: query.q.trim(),
                        mode: 'insensitive',
                      },
                    },
                    {
                      tradeName: {
                        contains: query.q.trim(),
                        mode: 'insensitive',
                      },
                    },
                  ],
                },
              },
              {
                user: {
                  OR: [
                    {
                      name: {
                        contains: query.q.trim(),
                        mode: 'insensitive',
                      },
                    },
                    {
                      email: {
                        contains: query.q.trim(),
                        mode: 'insensitive',
                      },
                    },
                  ],
                },
              },
            ],
          }
        : {}),
    };

    const [total, threads] = await Promise.all([
      this.prisma.supportThread.count({ where }),
      this.prisma.supportThread.findMany({
        where,
        orderBy: [
          { lifecycleStatus: 'asc' },
          { humanRequestedAt: 'asc' },
          { updatedAt: 'desc' },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: this.threadRowInclude(),
      }),
    ]);

    return {
      items: threads.map((thread) => this.serializeRow(thread)),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async detail(threadId: string, query: PlatformSupportMessagesQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 100;
    const thread = await this.prisma.supportThread.findUnique({
      where: { id: threadId },
      include: this.threadRowInclude(),
    });
    if (!thread) throw new NotFoundException('Conversa nao encontrada.');

    const [messagesTotal, messages] = await Promise.all([
      this.prisma.supportMessage.count({ where: { threadId } }),
      this.prisma.supportMessage.findMany({
        where: { threadId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          authorUser: { select: { id: true, name: true, email: true } },
        },
      }),
    ]);

    const row = this.serializeRow(thread, true);
    return {
      ...row,
      messages: messages.reverse().map((message) => ({
        id: message.id,
        role: this.messageRoleToClient(message.role),
        body: message.body,
        createdAt: message.createdAt.toISOString(),
        author: message.authorUser,
      })),
      messagesPage: page,
      messagesPageSize: pageSize,
      messagesTotal,
      messagesTotalPages: Math.max(1, Math.ceil(messagesTotal / pageSize)),
    };
  }

  async claim(platformUserId: string, threadId: string) {
    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.supportThread.updateMany({
        where: {
          id: threadId,
          lifecycleStatus: {
            in: [
              SupportLifecycleStatus.WAITING_HUMAN,
              SupportLifecycleStatus.IN_PROGRESS,
            ],
          },
          OR: [
            { assignedToUserId: null },
            { assignedToUserId: platformUserId },
          ],
        },
        data: {
          assignedToUserId: platformUserId,
          lifecycleStatus: SupportLifecycleStatus.IN_PROGRESS,
          status: SupportThreadStatus.HUMAN,
        },
      });
      if (!claimed.count) {
        const exists = await tx.supportThread.findUnique({
          where: { id: threadId },
          select: { assignedToUserId: true },
        });
        if (!exists) throw new NotFoundException('Conversa nao encontrada.');
        throw new ConflictException(
          'Esta conversa ja foi assumida por outro atendente.',
        );
      }
      const claimedThread = await tx.supportThread.findUniqueOrThrow({
        where: { id: threadId },
        select: { organizationId: true },
      });
      await tx.auditLog.create({
        data: {
          action: 'SUPPORT_THREAD_CLAIMED',
          organizationId: claimedThread.organizationId,
          userId: platformUserId,
          entityType: 'SupportThread',
          entityId: threadId,
        },
      });
    });
    return this.detail(threadId, {});
  }

  async reply(platformUserId: string, threadId: string, body: string) {
    const text = body.trim();
    if (!text) throw new BadRequestException('Escreva uma resposta.');
    const thread = await this.prisma.supportThread.findUnique({
      where: { id: threadId },
      select: {
        id: true,
        organizationId: true,
        servedClientId: true,
        assignedToUserId: true,
        firstHumanResponseAt: true,
        lifecycleStatus: true,
      },
    });
    if (!thread) throw new NotFoundException('Conversa nao encontrada.');
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const locked = await tx.supportThread.updateMany({
        where: {
          id: threadId,
          lifecycleStatus: SupportLifecycleStatus.IN_PROGRESS,
          assignedToUserId: platformUserId,
        },
        data: {
          lastMessageAt: now,
          updatedAt: now,
        },
      });
      if (!locked.count) {
        throw new ConflictException(
          'Assuma esta conversa antes de responder ou atualize a fila.',
        );
      }
      if (!thread.firstHumanResponseAt) {
        await tx.supportThread.updateMany({
          where: { id: threadId, firstHumanResponseAt: null },
          data: { firstHumanResponseAt: now },
        });
      }
      await tx.supportMessage.create({
        data: {
          organizationId: thread.organizationId,
          servedClientId: thread.servedClientId,
          threadId,
          role: SupportMessageRole.HUMAN_SUPPORT,
          body: text,
          authorUserId: platformUserId,
          meta: { source: 'platform_support_center' },
        },
      });
      await tx.auditLog.create({
        data: {
          action: 'SUPPORT_HUMAN_REPLIED',
          organizationId: thread.organizationId,
          userId: platformUserId,
          entityType: 'SupportThread',
          entityId: threadId,
        },
      });
    });
    return this.detail(threadId, {});
  }

  async resolve(platformUserId: string, threadId: string) {
    return this.finishHumanFlow(platformUserId, threadId, true);
  }

  async returnToAi(platformUserId: string, threadId: string) {
    return this.finishHumanFlow(platformUserId, threadId, false);
  }

  private async finishHumanFlow(
    platformUserId: string,
    threadId: string,
    resolved: boolean,
  ) {
    const thread = await this.prisma.supportThread.findUnique({
      where: { id: threadId },
      select: {
        id: true,
        organizationId: true,
        servedClientId: true,
        assignedToUserId: true,
      },
    });
    if (!thread) throw new NotFoundException('Conversa nao encontrada.');
    const now = new Date();
    const message = resolved
      ? 'Atendimento humano encerrado pela equipe ProntEPI.'
      : 'Atendimento devolvido ao agente automatico pela equipe ProntEPI.';
    await this.prisma.$transaction(async (tx) => {
      const locked = await tx.supportThread.updateMany({
        where: {
          id: threadId,
          lifecycleStatus: SupportLifecycleStatus.IN_PROGRESS,
          assignedToUserId: platformUserId,
        },
        data: {
          status: SupportThreadStatus.AI,
          lifecycleStatus: resolved
            ? SupportLifecycleStatus.RESOLVED
            : SupportLifecycleStatus.ACTIVE,
          resolvedAt: resolved ? now : null,
          assignedToUserId: null,
          lastMessageAt: now,
          updatedAt: now,
        },
      });
      if (!locked.count) {
        throw new ConflictException(
          'Assuma esta conversa antes de encerrar ou atualize a fila.',
        );
      }
      await tx.supportMessage.create({
        data: {
          organizationId: thread.organizationId,
          servedClientId: thread.servedClientId,
          threadId,
          role: SupportMessageRole.SYSTEM,
          body: message,
          authorUserId: platformUserId,
          meta: { source: 'platform_support_center' },
        },
      });
      await tx.auditLog.create({
        data: {
          action: resolved
            ? 'SUPPORT_THREAD_RESOLVED'
            : 'SUPPORT_THREAD_RETURNED_TO_AI',
          organizationId: thread.organizationId,
          userId: platformUserId,
          entityType: 'SupportThread',
          entityId: threadId,
        },
      });
    });
    return this.detail(threadId, {});
  }

  private threadRowInclude() {
    return {
      organization: { select: { id: true, name: true } },
      servedClient: {
        select: { id: true, legalName: true, tradeName: true },
      },
      user: { select: { id: true, name: true, email: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
      messages: {
        orderBy: { createdAt: 'desc' as const },
        take: 1,
        select: { role: true, body: true, createdAt: true },
      },
      _count: { select: { messages: true } },
    };
  }

  private serializeRow(thread: {
    id: string;
    scope: 'CONSULTORIA' | 'CLIENTE';
    status: SupportThreadStatus;
    lifecycleStatus: SupportLifecycleStatus;
    organization: { id: string; name: string };
    servedClient: {
      id: string;
      legalName: string;
      tradeName: string | null;
    } | null;
    user: { id: string; name: string; email: string } | null;
    assignedTo: { id: string; name: string; email: string } | null;
    humanRequestedAt: Date | null;
    firstHumanResponseAt: Date | null;
    resolvedAt: Date | null;
    lastMessageAt: Date | null;
    updatedAt: Date;
    messages: Array<{
      role: SupportMessageRole;
      body: string;
      createdAt: Date;
    }>;
    _count: { messages: number };
  }, includeSensitive = false) {
    const lastMessage = thread.messages[0];
    return {
      id: thread.id,
      scope: thread.scope,
      status: thread.status === SupportThreadStatus.HUMAN ? 'human' : 'ai',
      lifecycleStatus: thread.lifecycleStatus,
      organization: thread.organization,
      servedClient: thread.servedClient
        ? {
            id: thread.servedClient.id,
            name:
              thread.servedClient.tradeName || thread.servedClient.legalName,
          }
        : null,
      requester: thread.user
        ? {
            id: thread.user.id,
            name: thread.user.name,
            ...(includeSensitive ? { email: thread.user.email } : {}),
          }
        : null,
      assignedTo: thread.assignedTo
        ? {
            id: thread.assignedTo.id,
            name: thread.assignedTo.name,
            ...(includeSensitive ? { email: thread.assignedTo.email } : {}),
          }
        : null,
      humanRequestedAt: thread.humanRequestedAt?.toISOString() ?? null,
      firstHumanResponseAt:
        thread.firstHumanResponseAt?.toISOString() ?? null,
      resolvedAt: thread.resolvedAt?.toISOString() ?? null,
      lastMessageAt: thread.lastMessageAt?.toISOString() ?? null,
      updatedAt: thread.updatedAt.toISOString(),
      messageCount: thread._count.messages,
      lastMessage: lastMessage
        ? {
            role: this.messageRoleToClient(lastMessage.role),
            body:
              lastMessage.body.length > 240
                ? `${lastMessage.body.slice(0, 237)}...`
                : lastMessage.body,
            createdAt: lastMessage.createdAt.toISOString(),
          }
        : null,
    };
  }

  private messageRoleToClient(role: SupportMessageRole) {
    if (role === SupportMessageRole.USER) return 'user';
    if (role === SupportMessageRole.ASSISTANT) return 'assistant';
    if (role === SupportMessageRole.HUMAN_SUPPORT) return 'human_support';
    return 'system';
  }
}
