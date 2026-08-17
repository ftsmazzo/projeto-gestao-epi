import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EpiCategory, EpiUsefulLifeUnit, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateEpiNeedDto,
  LinkEpiNeedItemDto,
  MatchEpiNeedsDto,
  UpdateEpiNeedDto,
} from './dto/epi-need.dto';
import {
  DEFAULT_EPI_NEED_SEEDS,
  resolveEpiNeedSeedByName,
  suggestNeedNamesFromText,
} from './epi-need-suggest';
import {
  epiNeedsAreSame,
  findMatchingEpiNeed,
  isJunkEpiNeedName,
  resolveEpiNeedSeedForIdentity,
} from './epi-need-canonical';
import { resolveUsefulLife } from './epi-useful-life.defaults';

function parseAliases(value: Prisma.JsonValue | null | undefined): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }
  return [];
}

@Injectable()
export class EpiNeedsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(
    organizationId: string,
    filters: {
      q?: string;
      category?: string;
      status?: 'active' | 'inactive' | 'all';
    },
  ) {
    const status = filters.status ?? 'all';
    const q = filters.q?.trim();

    const needs = await this.prisma.epiNeed.findMany({
      where: {
        organizationId,
        ...(status === 'active' ? { isActive: true } : {}),
        ...(status === 'inactive' ? { isActive: false } : {}),
        ...(filters.category
          ? { category: filters.category as EpiCategory }
          : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { description: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        _count: { select: { itemLinks: true } },
      },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });

    const needIds = needs.map((n) => n.id);
    const stockByNeed = await this.sumStockByNeedIds(organizationId, needIds);

    return needs
      .map((need) => {
        const aliases = parseAliases(need.aliases);
        if (q) {
          const qNorm = q.toLowerCase();
          const aliasHit = aliases.some((a) =>
            a.toLowerCase().includes(qNorm),
          );
          const nameHit = need.name.toLowerCase().includes(qNorm);
          const descHit = (need.description ?? '')
            .toLowerCase()
            .includes(qNorm);
          if (!aliasHit && !nameHit && !descHit) {
            return null;
          }
        }
        const stock = stockByNeed.get(need.id) ?? {
          linkedItems: need._count.itemLinks,
          totalQuantity: 0,
        };
        return {
          ...need,
          aliases,
          linkedItemsCount: need._count.itemLinks,
          totalStockQuantity: stock.totalQuantity,
          stockStatus:
            need._count.itemLinks === 0
              ? ('UNLINKED' as const)
              : stock.totalQuantity > 0
                ? ('WITH_STOCK' as const)
                : ('NO_STOCK' as const),
        };
      })
      .filter((row): row is NonNullable<typeof row> => row != null);
  }

  async getById(organizationId: string, id: string) {
    const need = await this.prisma.epiNeed.findFirst({
      where: { id, organizationId },
      include: {
        itemLinks: {
          include: {
            epiItem: {
              select: {
                id: true,
                name: true,
                caNumber: true,
                category: true,
                isActive: true,
                manufacturerName: true,
              },
            },
          },
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
        },
      },
    });
    if (!need) {
      throw new NotFoundException('Necessidade de EPI nao encontrada.');
    }

    const itemIds = need.itemLinks.map((link) => link.epiItemId);
    const totals = await this.prisma.epiStockBalance.groupBy({
      by: ['epiItemId'],
      where: { organizationId, epiItemId: { in: itemIds } },
      _sum: { quantity: true },
    });
    const qtyByItem = new Map(
      totals.map((row) => [row.epiItemId, row._sum.quantity ?? 0]),
    );

    const totalStockQuantity = itemIds.reduce(
      (sum, itemId) => sum + (qtyByItem.get(itemId) ?? 0),
      0,
    );

    return {
      ...need,
      aliases: parseAliases(need.aliases),
      linkedItemsCount: need.itemLinks.length,
      totalStockQuantity,
      stockStatus:
        need.itemLinks.length === 0
          ? ('UNLINKED' as const)
          : totalStockQuantity > 0
            ? ('WITH_STOCK' as const)
            : ('NO_STOCK' as const),
      items: need.itemLinks.map((link) => ({
        ...link,
        stockQuantity: qtyByItem.get(link.epiItemId) ?? 0,
      })),
    };
  }

  async create(
    organizationId: string,
    userId: string,
    dto: CreateEpiNeedDto,
  ) {
    const name = dto.name.trim();
    await this.assertUniqueName(organizationId, name);

    const life =
      dto.usefulLifeValue != null && dto.usefulLifeValue > 0
        ? {
            value: dto.usefulLifeValue,
            unit: dto.usefulLifeUnit ?? EpiUsefulLifeUnit.DIAS,
          }
        : resolveUsefulLife({
            name,
            category: dto.category ?? null,
          });

    const seed = resolveEpiNeedSeedByName(name);
    const category = dto.category ?? seed?.category ?? null;

    const need = await this.prisma.epiNeed.create({
      data: {
        organizationId,
        name,
        category,
        description: this.normalizeOptionalText(dto.description),
        aliases: this.normalizeAliases(dto.aliases),
        usefulLifeValue: life?.value ?? seed?.usefulLifeValue ?? null,
        usefulLifeUnit: life?.unit ?? seed?.usefulLifeUnit ?? null,
      },
    });

    await this.audit.log({
      action: 'epi_need.created',
      organizationId,
      userId,
      entityType: 'EpiNeed',
      entityId: need.id,
      metadata: { name: need.name, category: need.category },
    });

    return { ...need, aliases: parseAliases(need.aliases) };
  }

  async update(
    organizationId: string,
    userId: string,
    id: string,
    dto: UpdateEpiNeedDto,
  ) {
    const existing = await this.requireNeed(organizationId, id);
    const nextName = dto.name?.trim();
    if (nextName && nextName.toLowerCase() !== existing.name.toLowerCase()) {
      await this.assertUniqueName(organizationId, nextName, id);
    }

    const need = await this.prisma.epiNeed.update({
      where: { id },
      data: {
        name: nextName,
        category: dto.category === undefined ? undefined : dto.category,
        description:
          dto.description === undefined
            ? undefined
            : this.normalizeOptionalText(dto.description),
        aliases:
          dto.aliases === undefined
            ? undefined
            : this.normalizeAliases(dto.aliases),
        ...(dto.usefulLifeValue !== undefined
          ? {
              usefulLifeValue: dto.usefulLifeValue,
              usefulLifeUnit:
                dto.usefulLifeValue == null
                  ? null
                  : (dto.usefulLifeUnit ??
                    existing.usefulLifeUnit ??
                    EpiUsefulLifeUnit.DIAS),
            }
          : {}),
      },
    });

    await this.audit.log({
      action: 'epi_need.updated',
      organizationId,
      userId,
      entityType: 'EpiNeed',
      entityId: need.id,
      metadata: {
        before: { name: existing.name, category: existing.category },
        after: { name: need.name, category: need.category },
      },
    });

    return { ...need, aliases: parseAliases(need.aliases) };
  }

  async updateStatus(
    organizationId: string,
    userId: string,
    id: string,
    isActive: boolean,
  ) {
    const existing = await this.requireNeed(organizationId, id);
    if (existing.isActive === isActive) {
      return { ...existing, aliases: parseAliases(existing.aliases) };
    }

    const need = await this.prisma.epiNeed.update({
      where: { id },
      data: { isActive },
    });

    await this.audit.log({
      action: 'epi_need.status_changed',
      organizationId,
      userId,
      entityType: 'EpiNeed',
      entityId: need.id,
      metadata: { from: existing.isActive, to: need.isActive },
    });

    return { ...need, aliases: parseAliases(need.aliases) };
  }

  async suggestDefaults(organizationId: string, userId: string) {
    const existing = await this.prisma.epiNeed.findMany({
      where: { organizationId },
      select: {
        id: true,
        name: true,
        category: true,
        usefulLifeValue: true,
      },
    });
    const existingNames = new Set(
      existing.map((row) => row.name.toLowerCase()),
    );

    const created = [];
    for (const seed of DEFAULT_EPI_NEED_SEEDS) {
      if (existingNames.has(seed.name.toLowerCase())) {
        const current = existing.find(
          (row) => row.name.toLowerCase() === seed.name.toLowerCase(),
        );
        if (current) {
          await this.prisma.epiNeed.update({
            where: { id: current.id },
            data: {
              usefulLifeValue: seed.usefulLifeValue,
              usefulLifeUnit: seed.usefulLifeUnit,
              ...(current.category ? {} : { category: seed.category }),
            },
          });
        }
        continue;
      }
      const need = await this.prisma.epiNeed.create({
        data: {
          organizationId,
          name: seed.name,
          category: seed.category,
          description: seed.description,
          aliases: seed.aliases,
          usefulLifeValue: seed.usefulLifeValue,
          usefulLifeUnit: seed.usefulLifeUnit,
          isActive: true,
        },
      });
      created.push({ ...need, aliases: parseAliases(need.aliases) });
    }

    // Necessidades ja criadas pelo PGR (ex.: "Botina de Borracha") sem categoria.
    const orphanNeeds = await this.prisma.epiNeed.findMany({
      where: { organizationId, OR: [{ category: null }, { usefulLifeValue: null }] },
      select: { id: true, name: true, category: true, usefulLifeValue: true },
    });
    for (const orphan of orphanNeeds) {
      const seed = resolveEpiNeedSeedByName(orphan.name);
      if (!seed) continue;
      await this.prisma.epiNeed.update({
        where: { id: orphan.id },
        data: {
          ...(orphan.category ? {} : { category: seed.category }),
          ...(orphan.usefulLifeValue != null
            ? {}
            : {
                usefulLifeValue: seed.usefulLifeValue,
                usefulLifeUnit: seed.usefulLifeUnit,
              }),
        },
      });
    }

    await this.audit.log({
      action: 'epi_need.defaults_suggested',
      organizationId,
      userId,
      entityType: 'EpiNeed',
      entityId: organizationId,
      metadata: { createdCount: created.length },
    });

    return {
      createdCount: created.length,
      skippedCount: DEFAULT_EPI_NEED_SEEDS.length - created.length,
      created,
    };
  }

  async matchSuggestions(
    organizationId: string,
    dto: MatchEpiNeedsDto,
  ) {
    const names = suggestNeedNamesFromText(dto);
    if (names.length === 0) {
      return { suggestions: [] as Array<{ id: string; name: string; category: EpiCategory | null }> };
    }

    const needs = await this.prisma.epiNeed.findMany({
      where: {
        organizationId,
        isActive: true,
        OR: names.map((name) => ({
          name: { equals: name, mode: 'insensitive' as const },
        })),
      },
      select: { id: true, name: true, category: true },
      orderBy: { name: 'asc' },
    });

    return {
      suggestions: needs,
      unmatchedNames: names.filter(
        (name) =>
          !needs.some((n) => n.name.toLowerCase() === name.toLowerCase()),
      ),
    };
  }

  async listItems(organizationId: string, needId: string) {
    const detail = await this.getById(organizationId, needId);
    return detail.items;
  }

  async linkItem(
    organizationId: string,
    userId: string,
    needId: string,
    dto: LinkEpiNeedItemDto,
  ) {
    const need = await this.requireNeed(organizationId, needId);
    const epi = await this.prisma.epiItem.findFirst({
      where: { id: dto.epiItemId, organizationId },
      select: { id: true, name: true, usefulLifeValue: true, usefulLifeUnit: true },
    });
    if (!epi) {
      throw new NotFoundException('EPI nao encontrado neste tenant.');
    }

    const existing = await this.prisma.epiItemNeed.findFirst({
      where: { organizationId, epiItemId: dto.epiItemId, epiNeedId: needId },
    });
    if (existing) {
      throw new ConflictException(
        'Este EPI ja esta vinculado a esta necessidade.',
      );
    }

    if (epi.usefulLifeValue == null) {
      const life = resolveUsefulLife({
        name: need.name,
        category: need.category,
        value: need.usefulLifeValue,
        unit: need.usefulLifeUnit,
      });
      if (life) {
        await this.prisma.epiItem.update({
          where: { id: epi.id },
          data: {
            usefulLifeValue: life.value,
            usefulLifeUnit: life.unit,
          },
        });
      }
    }

    const link = await this.prisma.epiItemNeed.create({
      data: {
        organizationId,
        epiItemId: dto.epiItemId,
        epiNeedId: needId,
        isPrimary: dto.isPrimary ?? false,
        notes: this.normalizeOptionalText(dto.notes),
      },
      include: {
        epiItem: {
          select: {
            id: true,
            name: true,
            caNumber: true,
            category: true,
            isActive: true,
          },
        },
      },
    });

    await this.audit.log({
      action: 'epi_need.item_linked',
      organizationId,
      userId,
      entityType: 'EpiItemNeed',
      entityId: link.id,
      metadata: {
        epiNeedId: needId,
        epiItemId: dto.epiItemId,
        epiName: epi.name,
      },
    });

    return link;
  }

  async unlinkItem(
    organizationId: string,
    userId: string,
    needId: string,
    epiItemId: string,
  ) {
    await this.requireNeed(organizationId, needId);
    const existing = await this.prisma.epiItemNeed.findFirst({
      where: { organizationId, epiNeedId: needId, epiItemId },
    });
    if (!existing) {
      throw new NotFoundException('Vinculo nao encontrado.');
    }

    await this.prisma.epiItemNeed.delete({ where: { id: existing.id } });

    await this.audit.log({
      action: 'epi_need.item_unlinked',
      organizationId,
      userId,
      entityType: 'EpiItemNeed',
      entityId: existing.id,
      metadata: { epiNeedId: needId, epiItemId },
    });

    return { ok: true };
  }

  async listNeedsByItem(organizationId: string, epiItemId: string) {
    const epi = await this.prisma.epiItem.findFirst({
      where: { id: epiItemId, organizationId },
      select: { id: true },
    });
    if (!epi) {
      throw new NotFoundException('EPI nao encontrado neste tenant.');
    }

    const links = await this.prisma.epiItemNeed.findMany({
      where: { organizationId, epiItemId },
      include: {
        epiNeed: true,
      },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });

    return links.map((link) => ({
      ...link,
      epiNeed: {
        ...link.epiNeed,
        aliases: parseAliases(link.epiNeed.aliases),
      },
    }));
  }

  async syncNeedsForItem(
    organizationId: string,
    userId: string,
    epiItemId: string,
    needIds: string[],
  ) {
    const epi = await this.prisma.epiItem.findFirst({
      where: { id: epiItemId, organizationId },
      select: { id: true, name: true },
    });
    if (!epi) {
      throw new NotFoundException('EPI nao encontrado neste tenant.');
    }

    const uniqueNeedIds = [...new Set(needIds.filter(Boolean))];
    if (uniqueNeedIds.length > 0) {
      const needs = await this.prisma.epiNeed.findMany({
        where: {
          organizationId,
          id: { in: uniqueNeedIds },
        },
        select: { id: true },
      });
      if (needs.length !== uniqueNeedIds.length) {
        throw new BadRequestException(
          'Uma ou mais necessidades nao pertencem a este tenant.',
        );
      }
    }

    const current = await this.prisma.epiItemNeed.findMany({
      where: { organizationId, epiItemId },
      select: { id: true, epiNeedId: true },
    });
    const currentIds = new Set(current.map((row) => row.epiNeedId));
    const nextIds = new Set(uniqueNeedIds);

    const toRemove = current.filter((row) => !nextIds.has(row.epiNeedId));
    const toAdd = uniqueNeedIds.filter((id) => !currentIds.has(id));

    await this.prisma.$transaction(async (tx) => {
      if (toRemove.length > 0) {
        await tx.epiItemNeed.deleteMany({
          where: { id: { in: toRemove.map((row) => row.id) } },
        });
      }
      for (const needId of toAdd) {
        await tx.epiItemNeed.create({
          data: {
            organizationId,
            epiItemId,
            epiNeedId: needId,
            isPrimary: false,
          },
        });
      }
    });

    await this.audit.log({
      action: 'epi_need.item_sync',
      organizationId,
      userId,
      entityType: 'EpiItem',
      entityId: epiItemId,
      metadata: {
        needIds: uniqueNeedIds,
        added: toAdd.length,
        removed: toRemove.length,
      },
    });

    return this.listNeedsByItem(organizationId, epiItemId);
  }

  /**
   * Vincula automaticamente quando ha exatamente uma necessidade correspondente clara.
   * Usado na importacao CSV — nunca bloqueia.
   */
  async autoLinkClearMatch(
    organizationId: string,
    userId: string,
    epiItemId: string,
    texts: MatchEpiNeedsDto,
  ) {
    try {
      const { suggestions } = await this.matchSuggestions(
        organizationId,
        texts,
      );
      if (suggestions.length !== 1) {
        return { linked: false, needId: null as string | null };
      }
      const needId = suggestions[0].id;
      const existing = await this.prisma.epiItemNeed.findFirst({
        where: { organizationId, epiItemId, epiNeedId: needId },
      });
      if (existing) {
        return { linked: false, needId };
      }
      await this.linkItem(organizationId, userId, needId, { epiItemId });
      return { linked: true, needId };
    } catch {
      return { linked: false, needId: null };
    }
  }

  private async sumStockByNeedIds(
    organizationId: string,
    needIds: string[],
  ): Promise<Map<string, { linkedItems: number; totalQuantity: number }>> {
    const result = new Map<
      string,
      { linkedItems: number; totalQuantity: number }
    >();
    if (needIds.length === 0) return result;

    const links = await this.prisma.epiItemNeed.findMany({
      where: { organizationId, epiNeedId: { in: needIds } },
      select: { epiNeedId: true, epiItemId: true },
    });

    const itemIds = [...new Set(links.map((l) => l.epiItemId))];
    const totals =
      itemIds.length === 0
        ? []
        : await this.prisma.epiStockBalance.groupBy({
            by: ['epiItemId'],
            where: { organizationId, epiItemId: { in: itemIds } },
            _sum: { quantity: true },
          });
    const qtyByItem = new Map(
      totals.map((row) => [row.epiItemId, row._sum.quantity ?? 0]),
    );

    for (const needId of needIds) {
      const needLinks = links.filter((l) => l.epiNeedId === needId);
      const totalQuantity = needLinks.reduce(
        (sum, link) => sum + (qtyByItem.get(link.epiItemId) ?? 0),
        0,
      );
      result.set(needId, {
        linkedItems: needLinks.length,
        totalQuantity,
      });
    }
    return result;
  }

  async consolidateDuplicates(organizationId: string, userId: string) {
    const needs = await this.prisma.epiNeed.findMany({
      where: { organizationId, isActive: true },
      include: {
        _count: {
          select: {
            itemLinks: true,
            jobRequirements: true,
            deliveryItems: true,
          },
        },
      },
    });

    let inactivatedJunk = 0;
    let mergedCount = 0;

    await this.prisma.$transaction(async (tx) => {
      for (const need of needs) {
        if (!isJunkEpiNeedName(need.name)) continue;
        await tx.jobFunctionEpiRequirement.updateMany({
          where: { epiNeedId: need.id, isActive: true },
          data: { isActive: false },
        });
        await tx.epiNeed.update({
          where: { id: need.id },
          data: { isActive: false },
        });
        inactivatedJunk += 1;
      }

      const keep = needs.filter((need) => !isJunkEpiNeedName(need.name));
      const parent = keep.map((_, index) => index);
      const find = (index: number): number => {
        if (parent[index] !== index) parent[index] = find(parent[index]);
        return parent[index];
      };
      for (let i = 0; i < keep.length; i += 1) {
        for (let j = i + 1; j < keep.length; j += 1) {
          if (epiNeedsAreSame(keep[i].name, keep[j].name)) {
            const a = find(i);
            const b = find(j);
            if (a !== b) parent[b] = a;
          }
        }
      }
      const groups = new Map<number, typeof keep>();
      keep.forEach((need, index) => {
        const root = find(index);
        const list = groups.get(root) ?? [];
        list.push(need);
        groups.set(root, list);
      });

      for (const group of groups.values()) {
        if (group.length < 2) continue;
        const ranked = [...group].sort((left, right) => {
          const leftScore = this.duplicateWinnerScore(left);
          const rightScore = this.duplicateWinnerScore(right);
          if (leftScore !== rightScore) return rightScore - leftScore;
          return left.createdAt.getTime() - right.createdAt.getTime();
        });
        const winner = ranked[0];
        for (const loser of ranked.slice(1)) {
          await this.mergeNeedInto(tx, organizationId, loser.id, winner.id);
          mergedCount += 1;
        }
        const seed = resolveEpiNeedSeedForIdentity(winner.name);
        if (!seed) continue;
        const clash = await tx.epiNeed.findFirst({
          where: {
            organizationId,
            id: { not: winner.id },
            isActive: true,
            name: { equals: seed.name, mode: 'insensitive' },
          },
          select: { id: true },
        });
        if (clash) continue;
        await tx.epiNeed.update({
          where: { id: winner.id },
          data: {
            name: seed.name,
            ...(winner.category ? {} : { category: seed.category }),
            ...(winner.usefulLifeValue != null
              ? {}
              : {
                  usefulLifeValue: seed.usefulLifeValue,
                  usefulLifeUnit: seed.usefulLifeUnit,
                }),
          },
        });
      }
    });

    await this.audit.log({
      action: 'epi_need.consolidated',
      organizationId,
      userId,
      entityType: 'EpiNeed',
      entityId: organizationId,
      metadata: { mergedCount, inactivatedJunk },
    });

    return { mergedCount, inactivatedJunk };
  }

  private duplicateWinnerScore(need: {
    name: string;
    category: EpiCategory | null;
    usefulLifeValue: number | null;
    _count: {
      itemLinks: number;
      jobRequirements: number;
      deliveryItems: number;
    };
  }): number {
    const seed = resolveEpiNeedSeedForIdentity(need.name);
    let score = 0;
    if (seed) score += 50;
    if (seed && need.name.toLowerCase() === seed.name.toLowerCase()) score += 80;
    score += need._count.itemLinks * 30;
    score += need._count.deliveryItems * 15;
    score += need._count.jobRequirements;
    if (need.category) score += 10;
    if (need.usefulLifeValue != null) score += 5;
    score -= Math.min(need.name.length, 80) / 10;
    return score;
  }

  private async mergeNeedInto(
    tx: Prisma.TransactionClient,
    organizationId: string,
    loserId: string,
    winnerId: string,
  ) {
    const loserLinks = await tx.epiItemNeed.findMany({
      where: { epiNeedId: loserId },
    });
    for (const link of loserLinks) {
      const exists = await tx.epiItemNeed.findFirst({
        where: {
          organizationId,
          epiItemId: link.epiItemId,
          epiNeedId: winnerId,
        },
        select: { id: true },
      });
      if (exists) {
        await tx.epiItemNeed.delete({ where: { id: link.id } });
      } else {
        await tx.epiItemNeed.update({
          where: { id: link.id },
          data: { epiNeedId: winnerId },
        });
      }
    }

    const reqs = await tx.jobFunctionEpiRequirement.findMany({
      where: { epiNeedId: loserId },
    });
    for (const req of reqs) {
      const exists = await tx.jobFunctionEpiRequirement.findFirst({
        where: {
          organizationId,
          jobFunctionId: req.jobFunctionId,
          epiNeedId: winnerId,
          riskId: req.riskId,
        },
        select: { id: true },
      });
      if (exists) {
        await tx.jobFunctionEpiRequirement.update({
          where: { id: req.id },
          data: { isActive: false },
        });
      } else {
        await tx.jobFunctionEpiRequirement.update({
          where: { id: req.id },
          data: { epiNeedId: winnerId },
        });
      }
    }

    await tx.epiDeliveryItem.updateMany({
      where: { epiNeedId: loserId },
      data: { epiNeedId: winnerId },
    });

    await tx.epiNeed.update({
      where: { id: loserId },
      data: { isActive: false },
    });
  }

  private async requireNeed(organizationId: string, id: string) {
    const need = await this.prisma.epiNeed.findFirst({
      where: { id, organizationId },
    });
    if (!need) {
      throw new NotFoundException('Necessidade de EPI nao encontrada.');
    }
    return need;
  }

  private async assertUniqueName(
    organizationId: string,
    name: string,
    excludeId?: string,
  ) {
    const others = await this.prisma.epiNeed.findMany({
      where: {
        organizationId,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true, name: true },
    });
    const exact = others.find(
      (row) => row.name.toLowerCase() === name.toLowerCase(),
    );
    const similar = findMatchingEpiNeed(name, others);
    if (exact || similar) {
      throw new ConflictException(
        'Ja existe uma necessidade com este nome (ou equivalente) neste tenant.',
      );
    }
  }

  private normalizeOptionalText(value?: string | null): string | null {
    if (value === undefined || value === null) return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private normalizeAliases(
    aliases?: string[] | null,
  ): Prisma.InputJsonValue | typeof Prisma.JsonNull {
    if (aliases === null) {
      return Prisma.JsonNull;
    }
    if (!aliases) {
      return [];
    }
    const cleaned = [
      ...new Set(
        aliases
          .map((item) => item.trim())
          .filter((item) => item.length > 0)
          .slice(0, 30),
      ),
    ];
    return cleaned;
  }
}
