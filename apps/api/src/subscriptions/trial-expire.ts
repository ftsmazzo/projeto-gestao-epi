import {
  ClientSubscriptionStatus,
  ServedClientStatus,
} from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';

export async function expireOverdueTrials(
  prisma: PrismaService,
  organizationId?: string,
) {
  const overdue = await prisma.clientSubscription.findMany({
    where: {
      ...(organizationId ? { organizationId } : {}),
      status: ClientSubscriptionStatus.TRIAL,
      trialEndsAt: { lt: new Date() },
    },
    include: { servedClient: { select: { allocatedLifeQuota: true } } },
  });

  for (const row of overdue) {
    await prisma.$transaction([
      prisma.clientSubscription.update({
        where: { id: row.id },
        data: {
          status: ClientSubscriptionStatus.SUSPENDED,
          suspendReason: 'TRIAL_EXPIRED',
          suspendedAt: new Date(),
          livesSnapshot: row.servedClient.allocatedLifeQuota,
        },
      }),
      prisma.servedClient.update({
        where: { id: row.servedClientId },
        data: { status: ServedClientStatus.INACTIVE },
      }),
    ]);
  }

  return overdue.length;
}

export async function expireTrialForClient(
  prisma: PrismaService,
  servedClientId: string,
) {
  const row = await prisma.clientSubscription.findUnique({
    where: { servedClientId },
    include: { servedClient: { select: { allocatedLifeQuota: true } } },
  });
  if (
    !row ||
    row.status !== ClientSubscriptionStatus.TRIAL ||
    !row.trialEndsAt ||
    row.trialEndsAt.getTime() >= Date.now()
  ) {
    return false;
  }

  await prisma.$transaction([
    prisma.clientSubscription.update({
      where: { id: row.id },
      data: {
        status: ClientSubscriptionStatus.SUSPENDED,
        suspendReason: 'TRIAL_EXPIRED',
        suspendedAt: new Date(),
        livesSnapshot: row.servedClient.allocatedLifeQuota,
      },
    }),
    prisma.servedClient.update({
      where: { id: servedClientId },
      data: { status: ServedClientStatus.INACTIVE },
    }),
  ]);
  return true;
}
