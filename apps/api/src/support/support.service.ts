import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ClientUserRole,
  MembershipRole,
  Prisma,
  SupportMessageRole,
  SupportThreadStatus,
} from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { buildSupportSystemPrompt } from './support-prompt';
import type { SupportScopeKind } from './support-knowledge';
import { searchSupportKnowledge, SUPPORT_KNOWLEDGE_VERSION } from './support-knowledge';

type SupportAudience = 'consultoria' | 'portal';

type SupportActor = {
  userId: string;
  organizationId: string;
  audience: SupportAudience;
  membershipRole?: string | null;
  clientRole?: string | null;
  servedClientId?: string | null;
};

type SendInput = {
  scope: SupportScopeKind;
  body: string;
  servedClientId?: string;
  currentPath?: string;
};

type EscalateInput = {
  scope: SupportScopeKind;
  servedClientId?: string;
  currentPath?: string;
  reason?: string;
};

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}

  async loadThread(
    actor: SupportActor,
    scope: SupportScopeKind,
    servedClientId?: string,
    currentPath?: string,
  ) {
    const context = await this.resolveContext(actor, scope, servedClientId);
    const thread = await this.getOrCreateThread(actor, context.scope, context.servedClientId);
    return this.serializeThread(thread, currentPath || null);
  }

  async sendMessage(actor: SupportActor, input: SendInput) {
    const context = await this.resolveContext(actor, input.scope, input.servedClientId);
    const body = input.body.trim();
    if (!body) throw new BadRequestException('Escreva uma mensagem.');

    const thread = await this.getOrCreateThread(actor, context.scope, context.servedClientId);
    const now = new Date();
    await this.prisma.supportMessage.create({
      data: {
        organizationId: actor.organizationId,
        servedClientId: context.servedClientId,
        threadId: thread.id,
        role: SupportMessageRole.USER,
        body,
        authorUserId: actor.userId,
      },
    });

    const asksHuman = /\b(humano|atendente|pessoa|suporte humano|falar com)\b/i.test(body);
    if (asksHuman) {
      await this.markHumanThread(thread.id, thread.meta, body.slice(0, 200));
      const reply =
        'Pedido de atendimento humano registrado. Enquanto isso, sigo te ajudando por aqui no que for operacional do ProntEPI.';
      await this.appendAssistantMessage(actor, context.servedClientId, thread.id, reply, {
        kind: 'escalate_ack',
      });
      return this.serializeThread(
        await this.prisma.supportThread.update({
          where: { id: thread.id },
          data: { lastMessageAt: now },
          include: { messages: { orderBy: { createdAt: 'asc' }, take: 200 } },
        }),
        input.currentPath || null,
      );
    }

    const reply = await this.buildAgentReply(
      actor,
      context.scope,
      context.servedClientId,
      body,
      input.currentPath || null,
    );
    await this.appendAssistantMessage(actor, context.servedClientId, thread.id, reply, {
      kind: 'ai_reply',
    });
    const updated = await this.prisma.supportThread.update({
      where: { id: thread.id },
      data: { lastMessageAt: now, updatedAt: now },
      include: { messages: { orderBy: { createdAt: 'asc' }, take: 200 } },
    });
    return this.serializeThread(updated, input.currentPath || null);
  }

  async escalate(actor: SupportActor, input: EscalateInput) {
    const context = await this.resolveContext(actor, input.scope, input.servedClientId);
    const thread = await this.getOrCreateThread(actor, context.scope, context.servedClientId);
    const reason = input.reason?.trim() || 'Pedido manual de atendimento humano';
    await this.markHumanThread(thread.id, thread.meta, reason);
    const reply =
      'Fila humana ativada para esta conversa. Se quiser, descreva o problema com mais detalhe para acelerar o atendimento.';
    await this.appendSystemMessage(actor, context.servedClientId, thread.id, reply, {
      kind: 'manual_escalate',
      reason,
    });
    return this.serializeThread(
      await this.prisma.supportThread.findUniqueOrThrow({
        where: { id: thread.id },
        include: { messages: { orderBy: { createdAt: 'asc' }, take: 200 } },
      }),
      input.currentPath || null,
    );
  }

  async returnToAi(
    actor: SupportActor,
    scope: SupportScopeKind,
    servedClientId?: string,
    currentPath?: string,
  ) {
    const context = await this.resolveContext(actor, scope, servedClientId);
    const thread = await this.getOrCreateThread(actor, context.scope, context.servedClientId);
    await this.prisma.supportThread.update({
      where: { id: thread.id },
      data: { status: SupportThreadStatus.AI, updatedAt: new Date() },
    });
    await this.appendSystemMessage(
      actor,
      context.servedClientId,
      thread.id,
      'Conversa voltou para modo automatico do agente de suporte.',
      { kind: 'return_ai' },
    );
    return this.serializeThread(
      await this.prisma.supportThread.findUniqueOrThrow({
        where: { id: thread.id },
        include: { messages: { orderBy: { createdAt: 'asc' }, take: 200 } },
      }),
      currentPath || null,
    );
  }

  private async resolveContext(
    actor: SupportActor,
    scope: SupportScopeKind,
    servedClientId?: string,
  ): Promise<{ scope: SupportScopeKind; servedClientId: string | null; clientName: string | null }> {
    if (actor.audience === 'portal') {
      if (scope !== 'CLIENTE') {
        throw new ForbiddenException('No portal, o suporte opera apenas no contexto do cliente.');
      }
      const clientId = actor.servedClientId;
      if (!clientId) throw new NotFoundException('Cliente do portal nao identificado.');
      const client = await this.prisma.servedClient.findFirst({
        where: { id: clientId, organizationId: actor.organizationId },
        select: { id: true, legalName: true, tradeName: true },
      });
      if (!client) throw new NotFoundException('Cliente nao encontrado.');
      return {
        scope: 'CLIENTE',
        servedClientId: client.id,
        clientName: client.tradeName || client.legalName,
      };
    }

    this.assertConsultoriaAccess(actor.membershipRole);
    if (scope === 'CONSULTORIA') {
      return { scope, servedClientId: null, clientName: null };
    }
    if (!servedClientId?.trim()) {
      throw new BadRequestException('Para o nivel cliente, informe servedClientId.');
    }
    const client = await this.prisma.servedClient.findFirst({
      where: {
        id: servedClientId.trim(),
        organizationId: actor.organizationId,
      },
      select: { id: true, legalName: true, tradeName: true },
    });
    if (!client) throw new NotFoundException('Cliente nao encontrado para este tenant.');
    return {
      scope,
      servedClientId: client.id,
      clientName: client.tradeName || client.legalName,
    };
  }

  private assertConsultoriaAccess(membershipRole?: string | null) {
    if (
      membershipRole !== MembershipRole.OWNER &&
      membershipRole !== MembershipRole.ADMIN &&
      membershipRole !== MembershipRole.MEMBER
    ) {
      throw new ForbiddenException('Perfil sem acesso ao suporte interno.');
    }
  }

  private async getOrCreateThread(
    actor: SupportActor,
    scope: SupportScopeKind,
    servedClientId: string | null,
  ) {
    const contextKey = this.contextKey(scope, servedClientId);
    const existing = await this.prisma.supportThread.findFirst({
      where: {
        organizationId: actor.organizationId,
        userId: actor.userId,
        scope,
        contextKey,
      },
      include: { messages: { orderBy: { createdAt: 'asc' }, take: 200 } },
    });
    if (existing) return existing;

    try {
      return await this.prisma.supportThread.create({
        data: {
          organizationId: actor.organizationId,
          userId: actor.userId,
          scope,
          servedClientId,
          contextKey,
          status: SupportThreadStatus.AI,
          meta: {
            audience: actor.audience,
            role:
              actor.audience === 'portal'
                ? actor.clientRole || 'CLIENT'
                : actor.membershipRole || 'MEMBER',
          } as Prisma.JsonObject,
        },
        include: { messages: { orderBy: { createdAt: 'asc' }, take: 200 } },
      });
    } catch (error) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const thread = await this.prisma.supportThread.findFirst({
          where: {
            organizationId: actor.organizationId,
            userId: actor.userId,
            scope,
            contextKey,
          },
          include: { messages: { orderBy: { createdAt: 'asc' }, take: 200 } },
        });
        if (thread) return thread;
      }
      throw error;
    }
  }

  private async markHumanThread(
    threadId: string,
    currentMeta: Prisma.JsonValue | null,
    reason: string,
  ) {
    const safeMeta =
      currentMeta && typeof currentMeta === 'object' && !Array.isArray(currentMeta)
        ? (currentMeta as Prisma.JsonObject)
        : ({} as Prisma.JsonObject);
    await this.prisma.supportThread.update({
      where: { id: threadId },
      data: {
        status: SupportThreadStatus.HUMAN,
        humanRequestedAt: new Date(),
        updatedAt: new Date(),
        meta: { ...safeMeta, lastEscalateReason: reason } as Prisma.JsonObject,
      },
    });
  }

  private async appendAssistantMessage(
    actor: SupportActor,
    servedClientId: string | null,
    threadId: string,
    body: string,
    meta?: Record<string, unknown>,
  ) {
    await this.prisma.supportMessage.create({
      data: {
        organizationId: actor.organizationId,
        servedClientId,
        threadId,
        role: SupportMessageRole.ASSISTANT,
        body,
        meta: (meta ?? null) as Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput,
      },
    });
  }

  private async appendSystemMessage(
    actor: SupportActor,
    servedClientId: string | null,
    threadId: string,
    body: string,
    meta?: Record<string, unknown>,
  ) {
    await this.prisma.supportMessage.create({
      data: {
        organizationId: actor.organizationId,
        servedClientId,
        threadId,
        role: SupportMessageRole.SYSTEM,
        body,
        meta: (meta ?? null) as Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput,
      },
    });
  }

  private async buildAgentReply(
    actor: SupportActor,
    scope: SupportScopeKind,
    servedClientId: string | null,
    userText: string,
    currentPath: string | null,
  ) {
    const knowledge = searchSupportKnowledge({
      query: userText,
      scope,
      currentPath,
      limit: 5,
    });
    const fallback = this.fallbackReply(scope, currentPath, knowledge);

    const llm = this.resolveLlmConfig();
    if (!llm) return fallback;

    const history = await this.prisma.supportMessage.findMany({
      where: {
        organizationId: actor.organizationId,
        thread: {
          organizationId: actor.organizationId,
          userId: actor.userId,
          scope,
          contextKey: this.contextKey(scope, servedClientId),
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 12,
      select: { role: true, body: true },
    });

    const system = buildSupportSystemPrompt({
      scope,
      currentPath: currentPath || undefined,
      humanChannelOnline: false,
      roleLabel:
        actor.audience === 'portal'
          ? this.clientRoleLabel(actor.clientRole)
          : this.consultoriaRoleLabel(actor.membershipRole),
    });
    const knowledgeContext =
      knowledge.length > 0
        ? knowledge
            .map(
              (item) =>
                [
                  `- ${item.title}: ${item.question} => ${item.answer}${item.route ? ` Link: [Abrir tela](${this.safeRouteForLink(item.route)})` : ''}`,
                  item.steps?.length ? `  passos: ${item.steps.join(' | ')}` : null,
                  item.warnings?.length ? `  cuidados: ${item.warnings.join(' | ')}` : null,
                ]
                  .filter(Boolean)
                  .join('\n'),
            )
            .join('\n')
        : '- Sem match forte. Responder com transparencia e orientar rota segura.';

    const messages = [
      { role: 'system', content: `${system}\n\nBase relevante:\n${knowledgeContext}` },
      ...history
        .reverse()
        .map((m) => ({
          role: m.role === SupportMessageRole.USER ? 'user' : 'assistant',
          content: m.body,
        })),
      { role: 'user', content: userText },
    ];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(llm.url, {
        method: 'POST',
        headers: llm.headers,
        signal: controller.signal,
        body: JSON.stringify({
          model: llm.model,
          temperature: 0.45,
          max_tokens: 600,
          messages,
        }),
      });
      if (!response.ok) return fallback;
      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string | null } }>;
      };
      const text = payload.choices?.[0]?.message?.content?.trim();
      return text || fallback;
    } catch {
      return fallback;
    } finally {
      clearTimeout(timeout);
    }
  }

  private fallbackReply(
    scope: SupportScopeKind,
    currentPath: string | null,
    knowledge: Array<{ answer: string; route?: string; question: string }>,
  ) {
    if (knowledge.length > 0) {
      const top = knowledge[0];
      const routePart = top.route
        ? ` Abra [Ir para tela](${this.safeRouteForLink(top.route)}).`
        : '';
      return `${top.answer}${routePart}`;
    }
    const pathPart = currentPath ? ` na tela ${currentPath}` : '';
    const scopeLabel = scope === 'CONSULTORIA' ? 'consultoria' : 'painel da empresa';
    return `Ainda nao achei uma instrucao especifica para isso no escopo ${scopeLabel}${pathPart}. Descreva a tarefa com mais detalhe (tela/acao esperada) que eu te guio no fluxo correto.`;
  }

  private resolveLlmConfig():
    | { url: string; model: string; headers: Record<string, string> }
    | null {
    const openRouterKey = process.env.OPENROUTER_API_KEY?.trim();
    if (openRouterKey) {
      const rawBase =
        process.env.OPENROUTER_BASE_URL?.trim() ||
        'https://openrouter.ai/api/v1/chat/completions';
      const url = rawBase.endsWith('/chat/completions')
        ? rawBase
        : `${rawBase.replace(/\/$/, '')}/chat/completions`;
      return {
        url,
        model:
          process.env.OPENROUTER_SUPPORT_MODEL?.trim() ||
          process.env.OPENROUTER_PGR_MODEL?.trim() ||
          'mistralai/mistral-small-3.2-24b-instruct',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${openRouterKey}`,
          'HTTP-Referer': process.env.PUBLIC_WEB_URL?.trim() || 'https://prontepi.com.br',
          'X-Title': 'ProntEPI Support',
        },
      };
    }

    const openAiKey = process.env.OPENAI_API_KEY?.trim();
    if (openAiKey) {
      const rawBase = process.env.OPENAI_BASE_URL?.trim() || 'https://api.openai.com/v1';
      return {
        url: `${rawBase.replace(/\/$/, '')}/chat/completions`,
        model: process.env.OPENAI_SUPPORT_MODEL?.trim() || 'gpt-4o-mini',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${openAiKey}`,
        },
      };
    }
    return null;
  }

  private consultoriaRoleLabel(role?: string | null) {
    if (role === MembershipRole.OWNER) return 'OWNER';
    if (role === MembershipRole.ADMIN) return 'ADMIN';
    if (role === MembershipRole.MEMBER) return 'MEMBER';
    return 'MEMBER';
  }

  private clientRoleLabel(role?: string | null) {
    if (role === ClientUserRole.CLIENT_MANAGER) return 'CLIENT_MANAGER';
    if (role === ClientUserRole.STOCK_OPERATOR) return 'STOCK_OPERATOR';
    return 'WORKER';
  }

  private serializeThread(
    thread: {
    id: string;
    status: SupportThreadStatus;
    scope: 'CONSULTORIA' | 'CLIENTE';
    servedClientId: string | null;
    humanRequestedAt: Date | null;
    messages: Array<{
      id: string;
      role: SupportMessageRole;
      body: string;
      createdAt: Date;
    }>;
    },
    currentPath: string | null,
  ) {
    return {
      id: thread.id,
      scope: thread.scope,
      currentPath,
      knowledgeVersion: SUPPORT_KNOWLEDGE_VERSION,
      servedClientId: thread.servedClientId,
      status: thread.status === SupportThreadStatus.HUMAN ? 'human' : 'ai',
      humanRequestedAt: thread.humanRequestedAt?.toISOString() ?? null,
      messages: thread.messages.map((message) => ({
        id: message.id,
        role: this.messageRoleToClient(message.role),
        body: message.body,
        createdAt: message.createdAt.toISOString(),
      })),
    };
  }

  private messageRoleToClient(role: SupportMessageRole) {
    if (role === SupportMessageRole.USER) return 'user';
    if (role === SupportMessageRole.ASSISTANT) return 'assistant';
    if (role === SupportMessageRole.HUMAN_SUPPORT) return 'human_support';
    return 'system';
  }

  private contextKey(scope: SupportScopeKind, servedClientId: string | null) {
    if (scope === 'CONSULTORIA') return 'consultoria';
    return servedClientId || 'cliente-desconhecido';
  }

  private safeRouteForLink(route: string) {
    if (!/\[[^\]]+\]/.test(route)) return route;
    if (route.startsWith('/clientes/')) return '/clientes';
    if (route.startsWith('/portal/trabalhadores/')) return '/portal/trabalhadores';
    if (route.startsWith('/portal/entregas/')) return '/portal/entregas';
    if (route.startsWith('/portal/estrutura/')) return '/portal/estrutura';
    return route.replace(/\/\[[^\]]+\]/g, '');
  }
}
