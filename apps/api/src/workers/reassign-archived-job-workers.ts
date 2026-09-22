import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { normalizeTextKey } from '../pgro/pgro-parser';

type JobRow = {
  id: string;
  name: string;
  sectorId: string;
  sector: { name: string };
};

/**
 * Quando o PGR roda de novo, pode arquivar a função antiga e criar outra
 * com o mesmo nome. Trabalhadores ficam no ID arquivado e a estrutura
 * mostra a versão ativa. Esta rotina religa pelo nome (e setor, se der).
 */
export async function reassignWorkersFromArchivedFunctions(
  db: Prisma.TransactionClient | PrismaService,
  organizationId: string,
  servedClientId: string,
): Promise<{ reassigned: number }> {
  const archivedJobs = await db.clientJobFunction.findMany({
    where: {
      organizationId,
      servedClientId,
      isActive: false,
      workers: { some: {} },
    },
    select: {
      id: true,
      name: true,
      sectorId: true,
      sector: { select: { name: true } },
    },
  });
  if (archivedJobs.length === 0) return { reassigned: 0 };

  const activeJobs = await db.clientJobFunction.findMany({
    where: { organizationId, servedClientId, isActive: true },
    select: {
      id: true,
      name: true,
      sectorId: true,
      sector: { select: { name: true } },
    },
  });

  const byName = new Map<string, JobRow[]>();
  for (const job of activeJobs) {
    const key = normalizeTextKey(job.name);
    const list = byName.get(key) ?? [];
    list.push(job);
    byName.set(key, list);
  }

  let reassigned = 0;
  for (const archived of archivedJobs) {
    const candidates = byName.get(normalizeTextKey(archived.name)) ?? [];
    if (candidates.length === 0) continue;

    const target =
      candidates.find((job) => job.sectorId === archived.sectorId) ??
      candidates.find(
        (job) =>
          normalizeTextKey(job.sector.name) ===
          normalizeTextKey(archived.sector.name),
      ) ??
      candidates[0];

    if (!target || target.id === archived.id) continue;

    const result = await db.worker.updateMany({
      where: {
        organizationId,
        servedClientId,
        clientJobFunctionId: archived.id,
      },
      data: {
        clientJobFunctionId: target.id,
        clientSectorId: target.sectorId,
      },
    });
    reassigned += result.count;
  }

  return { reassigned };
}

/** Escolhe o melhor registro de função ativa/arquivada pelo nome + setor. */
export function pickBestJobMatch<
  T extends {
    id: string;
    name: string;
    sectorId: string;
    isActive: boolean;
    sector: { name: string };
  },
>(
  candidates: T[],
  preferredSectorId: string | null,
  preferredSectorName: string | null,
): T | null {
  if (candidates.length === 0) return null;
  const ranked = [...candidates].sort((a, b) => {
    const score = (job: T) => {
      let s = 0;
      if (job.isActive) s += 100;
      if (preferredSectorId && job.sectorId === preferredSectorId) s += 50;
      if (
        preferredSectorName &&
        normalizeTextKey(job.sector.name) ===
          normalizeTextKey(preferredSectorName)
      ) {
        s += 25;
      }
      return s;
    };
    return score(b) - score(a);
  });
  return ranked[0] ?? null;
}
