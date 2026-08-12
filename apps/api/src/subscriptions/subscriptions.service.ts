import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  buildLifePriceQuote,
  DEFAULT_LIFE_REDUCERS,
  type ClientSubscriptionRow,
  type LifePriceQuote,
  type SubscriptionsOverview,
} from '@gestao-epi/shared';
import {
  ClientSubscriptionStatus,
  MembershipRole,
  ServedClientStatus,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { ServedClientsService } from '../served-clients/served-clients.service';
import type {
  ActivateSubscriptionDto,
  AdjustMonthlyDto,
  GrantLivesDto,
  ReactivateSubscriptionDto,
  ReplaceLifeReducersDto,
  StartTrialDto,
  SuspendSubscriptionDto,
  UpdateLifePricingDto,
} from './dto/subscription.dto';
import { expireOverdueTrials } from './trial-expire';

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly servedClients: ServedClientsService,
  ) {}

  assertCanManage(membershipRole: string) {
    if (
      membershipRole !== MembershipRole.OWNER &&
      membershipRole !== MembershipRole.ADMIN
    ) {
      throw new ForbiddenException(
        'Apenas OWNER ou ADMIN podem alterar assinaturas e precos.',
      );
    }
  }

  async getOverview(organizationId: string): Promise<SubscriptionsOverview> {
    await expireOverdueTrials(this.prisma, organizationId);
    const pricing = await this.getOrCreatePricing(organizationId);
    const quota = await this.servedClients.getQuotaSummary(organizationId);
    const clients = await this.prisma.servedClient.findMany({
      where: { organizationId },
      orderBy: { legalName: 'asc' },
      include: {
        subscription: true,
        _count: {
          select: { workers: { where: { status: 'ACTIVE' } } },
        },
      },
    });

    const rows: ClientSubscriptionRow[] = clients.map((client) => {
      const trialExpired = this.isTrialExpired(client.subscription);
      const complimentary =
        client.subscription?.status === ClientSubscriptionStatus.TRIAL &&
        !trialExpired;
      const quote = buildLifePriceQuote({
        unitPriceCents: pricing.unitPriceCents,
        lives: client.allocatedLifeQuota,
        reducers: pricing.reducers,
        overrideCents: client.subscription?.monthlyPriceCentsOverride ?? null,
        complimentary:
          complimentary ||
          client.subscription?.status === ClientSubscriptionStatus.SUSPENDED,
      });
      return {
        clientId: client.id,
        legalName: client.legalName,
        tradeName: client.tradeName,
        cnpj: client.cnpj,
        clientStatus: client.status,
        allocatedLives: client.allocatedLifeQuota,
        usedLives: client._count.workers,
        subscription: client.subscription
          ? {
              id: client.subscription.id,
              servedClientId: client.subscription.servedClientId,
              status: client.subscription.status,
              trialLives: client.subscription.trialLives,
              trialEndsAt: client.subscription.trialEndsAt?.toISOString() ?? null,
              trialExpired,
              monthlyPriceCentsOverride:
                client.subscription.monthlyPriceCentsOverride,
              livesSnapshot: client.subscription.livesSnapshot,
              suspendReason: client.subscription.suspendReason,
              suspendedAt:
                client.subscription.suspendedAt?.toISOString() ?? null,
              notes: client.subscription.notes,
              createdAt: client.subscription.createdAt.toISOString(),
              updatedAt: client.subscription.updatedAt.toISOString(),
            }
          : null,
        quote,
      };
    });

    const recurringMonthlyCents = rows
      .filter(
        (row) =>
          row.subscription?.status === 'ACTIVE' ||
          row.subscription?.status === 'PAST_DUE',
      )
      .reduce((sum, row) => sum + row.quote.chargedMonthlyCents, 0);

    return {
      quota: {
        contracted: quota.contracted,
        allocated: quota.allocated,
        available: quota.available,
        used: quota.used,
      },
      pricing: {
        id: pricing.id,
        organizationId: pricing.organizationId,
        unitPriceCents: pricing.unitPriceCents,
        currency: pricing.currency,
        defaultTrialDays: pricing.defaultTrialDays,
        defaultTrialLives: pricing.defaultTrialLives,
        reducers: pricing.reducers.map((item) => ({
          id: item.id,
          minLives: item.minLives,
          percentOff: item.percentOff,
          label: item.label,
        })),
        updatedAt: pricing.updatedAt.toISOString(),
      },
      summary: {
        recurringMonthlyCents,
        trialCount: rows.filter((row) => row.subscription?.status === 'TRIAL')
          .length,
        activeCount: rows.filter((row) => row.subscription?.status === 'ACTIVE')
          .length,
        pastDueCount: rows.filter(
          (row) => row.subscription?.status === 'PAST_DUE',
        ).length,
        suspendedCount: rows.filter(
          (row) => row.subscription?.status === 'SUSPENDED',
        ).length,
        withoutPlanCount: rows.filter((row) => !row.subscription).length,
      },
      clients: rows,
    };
  }

  previewQuote(
    organizationId: string,
    lives: number,
  ): Promise<LifePriceQuote> {
    return this.getOrCreatePricing(organizationId).then((pricing) =>
      buildLifePriceQuote({
        unitPriceCents: pricing.unitPriceCents,
        lives,
        reducers: pricing.reducers,
      }),
    );
  }

  async updatePricing(
    organizationId: string,
    userId: string,
    membershipRole: string,
    dto: UpdateLifePricingDto,
  ) {
    this.assertCanManage(membershipRole);
    const pricing = await this.getOrCreatePricing(organizationId);

    await this.prisma.organizationLifePricing.update({
      where: { id: pricing.id },
      data: {
        unitPriceCents: dto.unitPriceCents,
        defaultTrialDays: dto.defaultTrialDays,
        defaultTrialLives: dto.defaultTrialLives,
      },
    });

    await this.audit.log({
      action: 'subscription.pricing_updated',
      organizationId,
      userId,
      entityType: 'OrganizationLifePricing',
      entityId: pricing.id,
      metadata: { ...dto },
    });

    return this.getOverview(organizationId);
  }

  async replaceReducers(
    organizationId: string,
    userId: string,
    membershipRole: string,
    dto: ReplaceLifeReducersDto,
  ) {
    this.assertCanManage(membershipRole);
    const pricing = await this.getOrCreatePricing(organizationId);
    const items = [...dto.items].sort((a, b) => a.minLives - b.minLives);
    const mins = new Set(items.map((item) => item.minLives));
    if (mins.size !== items.length) {
      throw new BadRequestException(
        'Cada redutor precisa de uma quantidade minima unica de vidas.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.lifePriceReducer.deleteMany({ where: { pricingId: pricing.id } });
      if (items.length > 0) {
        await tx.lifePriceReducer.createMany({
          data: items.map((item) => ({
            pricingId: pricing.id,
            minLives: item.minLives,
            percentOff: item.percentOff,
            label: item.label?.trim() || `${item.minLives}+ vidas`,
          })),
        });
      }
    });

    await this.audit.log({
      action: 'subscription.reducers_replaced',
      organizationId,
      userId,
      entityType: 'OrganizationLifePricing',
      entityId: pricing.id,
      metadata: { count: items.length },
    });

    return this.getOverview(organizationId);
  }

  async startTrial(
    organizationId: string,
    userId: string,
    membershipRole: string,
    clientId: string,
    dto: StartTrialDto,
  ) {
    this.assertCanManage(membershipRole);
    const pricing = await this.getOrCreatePricing(organizationId);
    const client = await this.servedClients.getById(organizationId, clientId);
    const days = dto.days ?? pricing.defaultTrialDays;
    const lives = dto.lives ?? pricing.defaultTrialLives;
    const trialEndsAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    await this.servedClients.update(organizationId, userId, clientId, {
      allocatedLifeQuota: lives,
      status: ServedClientStatus.ACTIVE,
    });

    await this.prisma.clientSubscription.upsert({
      where: { servedClientId: clientId },
      create: {
        organizationId,
        servedClientId: clientId,
        status: ClientSubscriptionStatus.TRIAL,
        trialLives: lives,
        trialEndsAt,
        monthlyPriceCentsOverride: null,
        livesSnapshot: null,
        suspendReason: null,
        suspendedAt: null,
      },
      update: {
        status: ClientSubscriptionStatus.TRIAL,
        trialLives: lives,
        trialEndsAt,
        monthlyPriceCentsOverride: null,
        livesSnapshot: null,
        suspendReason: null,
        suspendedAt: null,
      },
    });

    await this.audit.log({
      action: 'subscription.trial_started',
      organizationId,
      userId,
      entityType: 'ServedClient',
      entityId: client.id,
      metadata: { days, lives, trialEndsAt: trialEndsAt.toISOString() },
    });

    return this.getOverview(organizationId);
  }

  async activatePaid(
    organizationId: string,
    userId: string,
    membershipRole: string,
    clientId: string,
    dto: ActivateSubscriptionDto,
  ) {
    this.assertCanManage(membershipRole);
    const client = await this.servedClients.getById(organizationId, clientId);

    await this.servedClients.update(organizationId, userId, clientId, {
      allocatedLifeQuota: dto.lives,
      status: ServedClientStatus.ACTIVE,
    });

    await this.prisma.clientSubscription.upsert({
      where: { servedClientId: clientId },
      create: {
        organizationId,
        servedClientId: clientId,
        status: ClientSubscriptionStatus.ACTIVE,
        trialLives: null,
        trialEndsAt: null,
        monthlyPriceCentsOverride: dto.monthlyPriceCentsOverride ?? null,
        livesSnapshot: null,
        suspendReason: null,
        suspendedAt: null,
      },
      update: {
        status: ClientSubscriptionStatus.ACTIVE,
        trialLives: null,
        trialEndsAt: null,
        monthlyPriceCentsOverride:
          dto.monthlyPriceCentsOverride === undefined
            ? undefined
            : dto.monthlyPriceCentsOverride,
        livesSnapshot: null,
        suspendReason: null,
        suspendedAt: null,
      },
    });

    await this.audit.log({
      action: 'subscription.activated',
      organizationId,
      userId,
      entityType: 'ServedClient',
      entityId: client.id,
      metadata: { lives: dto.lives },
    });

    return this.getOverview(organizationId);
  }

  async grantLives(
    organizationId: string,
    userId: string,
    membershipRole: string,
    clientId: string,
    dto: GrantLivesDto,
  ) {
    this.assertCanManage(membershipRole);
    const client = await this.servedClients.getById(organizationId, clientId);
    if (client.status !== ServedClientStatus.ACTIVE) {
      throw new BadRequestException(
        'Reative a assinatura antes de ceder mais vidas.',
      );
    }
    const next = client.allocatedLifeQuota + dto.extraLives;
    await this.servedClients.update(organizationId, userId, clientId, {
      allocatedLifeQuota: next,
    });
    await this.audit.log({
      action: 'subscription.lives_granted',
      organizationId,
      userId,
      entityType: 'ServedClient',
      entityId: client.id,
      metadata: { extraLives: dto.extraLives, next },
    });
    return this.getOverview(organizationId);
  }

  async adjustMonthly(
    organizationId: string,
    userId: string,
    membershipRole: string,
    clientId: string,
    dto: AdjustMonthlyDto,
  ) {
    this.assertCanManage(membershipRole);
    await this.servedClients.getById(organizationId, clientId);
    const existing = await this.prisma.clientSubscription.findUnique({
      where: { servedClientId: clientId },
    });
    if (!existing) {
      throw new BadRequestException(
        'Ative a assinatura ou o teste antes de ajustar a mensalidade.',
      );
    }
    if (existing.status === ClientSubscriptionStatus.TRIAL) {
      throw new BadRequestException(
        'No periodo de teste a mensalidade e zero. Converta para pago para ajustar.',
      );
    }

    await this.prisma.clientSubscription.update({
      where: { id: existing.id },
      data: {
        monthlyPriceCentsOverride:
          dto.monthlyPriceCents === undefined ? null : dto.monthlyPriceCents,
      },
    });

    await this.audit.log({
      action: 'subscription.monthly_adjusted',
      organizationId,
      userId,
      entityType: 'ServedClient',
      entityId: clientId,
      metadata: { monthlyPriceCents: dto.monthlyPriceCents ?? null },
    });

    return this.getOverview(organizationId);
  }

  async markPastDue(
    organizationId: string,
    userId: string,
    membershipRole: string,
    clientId: string,
  ) {
    this.assertCanManage(membershipRole);
    const existing = await this.requireSubscription(clientId, organizationId);
    if (existing.status === ClientSubscriptionStatus.SUSPENDED) {
      throw new BadRequestException('Cliente ja esta suspenso.');
    }
    await this.prisma.clientSubscription.update({
      where: { id: existing.id },
      data: { status: ClientSubscriptionStatus.PAST_DUE },
    });
    await this.audit.log({
      action: 'subscription.past_due',
      organizationId,
      userId,
      entityType: 'ServedClient',
      entityId: clientId,
    });
    return this.getOverview(organizationId);
  }

  async suspendForNonPayment(
    organizationId: string,
    userId: string,
    membershipRole: string,
    clientId: string,
    dto: SuspendSubscriptionDto,
  ) {
    this.assertCanManage(membershipRole);
    const client = await this.servedClients.getById(organizationId, clientId);
    const existing = await this.prisma.clientSubscription.findUnique({
      where: { servedClientId: clientId },
    });

    await this.prisma.clientSubscription.upsert({
      where: { servedClientId: clientId },
      create: {
        organizationId,
        servedClientId: clientId,
        status: ClientSubscriptionStatus.SUSPENDED,
        livesSnapshot: client.allocatedLifeQuota,
        suspendReason: dto.reason?.trim() || 'NON_PAYMENT',
        suspendedAt: new Date(),
      },
      update: {
        status: ClientSubscriptionStatus.SUSPENDED,
        livesSnapshot: client.allocatedLifeQuota,
        suspendReason: dto.reason?.trim() || 'NON_PAYMENT',
        suspendedAt: new Date(),
      },
    });

    if (client.status !== ServedClientStatus.INACTIVE) {
      await this.servedClients.updateStatus(
        organizationId,
        userId,
        clientId,
        ServedClientStatus.INACTIVE,
      );
    }

    await this.audit.log({
      action: 'subscription.suspended_non_payment',
      organizationId,
      userId,
      entityType: 'ServedClient',
      entityId: clientId,
      metadata: {
        previousStatus: existing?.status ?? null,
        livesSnapshot: client.allocatedLifeQuota,
      },
    });

    return this.getOverview(organizationId);
  }

  async reactivate(
    organizationId: string,
    userId: string,
    membershipRole: string,
    clientId: string,
    dto: ReactivateSubscriptionDto,
  ) {
    this.assertCanManage(membershipRole);
    const client = await this.servedClients.getById(organizationId, clientId);
    const existing = await this.requireSubscription(clientId, organizationId);
    const lives =
      dto.lives ??
      existing.livesSnapshot ??
      client.allocatedLifeQuota;

    await this.servedClients.update(organizationId, userId, clientId, {
      allocatedLifeQuota: lives,
      status: ServedClientStatus.ACTIVE,
    });

    await this.prisma.clientSubscription.update({
      where: { id: existing.id },
      data: {
        status: ClientSubscriptionStatus.ACTIVE,
        trialLives: null,
        trialEndsAt: null,
        livesSnapshot: null,
        suspendReason: null,
        suspendedAt: null,
      },
    });

    await this.audit.log({
      action: 'subscription.reactivated',
      organizationId,
      userId,
      entityType: 'ServedClient',
      entityId: clientId,
      metadata: { lives },
    });

    return this.getOverview(organizationId);
  }

  private async requireSubscription(clientId: string, organizationId: string) {
    const existing = await this.prisma.clientSubscription.findFirst({
      where: { servedClientId: clientId, organizationId },
    });
    if (!existing) {
      throw new NotFoundException('Este cliente ainda nao tem assinatura.');
    }
    return existing;
  }

  private isTrialExpired(sub: {
    status: ClientSubscriptionStatus;
    trialEndsAt: Date | null;
  } | null) {
    return Boolean(
      sub &&
        sub.status === ClientSubscriptionStatus.TRIAL &&
        sub.trialEndsAt &&
        sub.trialEndsAt.getTime() < Date.now(),
    );
  }

  private async getOrCreatePricing(organizationId: string) {
    const existing = await this.prisma.organizationLifePricing.findUnique({
      where: { organizationId },
      include: { reducers: { orderBy: { minLives: 'asc' } } },
    });
    if (existing) return existing;

    return this.prisma.organizationLifePricing.create({
      data: {
        organizationId,
        unitPriceCents: 120,
        reducers: {
          create: DEFAULT_LIFE_REDUCERS.map((item) => ({
            minLives: item.minLives,
            percentOff: item.percentOff,
            label: item.label,
          })),
        },
      },
      include: { reducers: { orderBy: { minLives: 'asc' } } },
    });
  }
}
