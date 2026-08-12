import { normalizeTextKey } from './pgro-parser';

export type PgroDiffRow = {
  name: string;
  sectorName: string | null;
  workerCount: number;
};

export type PgroStructureDiff = {
  sectorsAdded: PgroDiffRow[];
  sectorsKept: PgroDiffRow[];
  sectorsReactivated: PgroDiffRow[];
  sectorsToArchive: PgroDiffRow[];
  functionsAdded: PgroDiffRow[];
  functionsKept: PgroDiffRow[];
  functionsReactivated: PgroDiffRow[];
  functionsToArchive: PgroDiffRow[];
};

export type ExistingPgroSector = {
  name: string;
  isActive: boolean;
  operationalUnitId?: string | null;
  jobs: Array<{
    name: string;
    isActive: boolean;
    workerCount: number;
  }>;
};

export type ParsedPgroSector = {
  name: string;
  included?: boolean;
};

export type ParsedPgroFunction = {
  name: string;
  sectorName?: string | null;
  included?: boolean;
};

export function sectorKey(name: string): string {
  return normalizeTextKey(name);
}

export function functionKey(
  sectorName: string | null | undefined,
  name: string,
): string {
  return `${normalizeTextKey(sectorName ?? '')}::${normalizeTextKey(name)}`;
}

export function cnpjDigits(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '');
}

export function assessPgroCompanyMatch(input: {
  clientCnpj: string;
  parsedCnpj: string | null | undefined;
}): {
  cnpjMatches: boolean | null;
  canConfirm: boolean;
  warning: string | null;
} {
  const client = cnpjDigits(input.clientCnpj);
  const parsed = cnpjDigits(input.parsedCnpj);
  if (!parsed) {
    return {
      cnpjMatches: null,
      canConfirm: true,
      warning:
        'O PDF nao trouxe CNPJ claro. Confira se o documento e desta empresa antes de confirmar.',
    };
  }
  if (client && parsed !== client) {
    return {
      cnpjMatches: false,
      canConfirm: false,
      warning:
        'O CNPJ do PDF nao confere com a empresa logada. Este PGR nao pode ser aplicado aqui.',
    };
  }
  return { cnpjMatches: true, canConfirm: true, warning: null };
}

export function buildPgroStructureDiff(input: {
  existingSectors: ExistingPgroSector[];
  parsedSectors: ParsedPgroSector[];
  parsedFunctions: ParsedPgroFunction[];
}): PgroStructureDiff {
  const existingMatriz = input.existingSectors.filter(
    (sector) => !sector.operationalUnitId,
  );

  const parsedSectorNames = new Map<string, string>();
  for (const sector of input.parsedSectors) {
    if (sector.included === false) continue;
    const name = sector.name.trim();
    if (!name) continue;
    parsedSectorNames.set(sectorKey(name), name);
  }

  const parsedFunctions: Array<{
    key: string;
    name: string;
    sectorName: string;
  }> = [];
  const parsedFunctionKeys = new Set<string>();

  for (const fn of input.parsedFunctions) {
    if (fn.included === false) continue;
    const name = fn.name.trim();
    if (!name) continue;
    const sectorName = fn.sectorName?.trim() || 'Geral';
    parsedSectorNames.set(sectorKey(sectorName), sectorName);
    const key = functionKey(sectorName, name);
    if (parsedFunctionKeys.has(key)) continue;
    parsedFunctionKeys.add(key);
    parsedFunctions.push({ key, name, sectorName });
  }

  const existingBySector = new Map<
    string,
    {
      name: string;
      isActive: boolean;
      jobs: Map<
        string,
        { name: string; isActive: boolean; workerCount: number }
      >;
    }
  >();

  for (const sector of existingMatriz) {
    const sKey = sectorKey(sector.name);
    const jobs = new Map<
      string,
      { name: string; isActive: boolean; workerCount: number }
    >();
    for (const job of sector.jobs) {
      jobs.set(sectorKey(job.name), {
        name: job.name,
        isActive: job.isActive,
        workerCount: job.workerCount,
      });
    }
    existingBySector.set(sKey, {
      name: sector.name,
      isActive: sector.isActive,
      jobs,
    });
  }

  const sectorsAdded: PgroDiffRow[] = [];
  const sectorsKept: PgroDiffRow[] = [];
  const sectorsReactivated: PgroDiffRow[] = [];
  const sectorsToArchive: PgroDiffRow[] = [];
  const functionsAdded: PgroDiffRow[] = [];
  const functionsKept: PgroDiffRow[] = [];
  const functionsReactivated: PgroDiffRow[] = [];
  const functionsToArchive: PgroDiffRow[] = [];

  for (const [sKey, displayName] of parsedSectorNames) {
    const existing = existingBySector.get(sKey);
    const workerCount = existing
      ? [...existing.jobs.values()].reduce((acc, job) => acc + job.workerCount, 0)
      : 0;
    const row: PgroDiffRow = {
      name: existing?.name ?? displayName,
      sectorName: null,
      workerCount,
    };
    if (!existing) {
      sectorsAdded.push(row);
    } else if (!existing.isActive) {
      sectorsReactivated.push(row);
    } else {
      sectorsKept.push(row);
    }
  }

  for (const [sKey, existing] of existingBySector) {
    if (parsedSectorNames.has(sKey)) continue;
    const hasActiveJob = [...existing.jobs.values()].some((job) => job.isActive);
    if (!existing.isActive && !hasActiveJob) continue;
    sectorsToArchive.push({
      name: existing.name,
      sectorName: null,
      workerCount: [...existing.jobs.values()].reduce(
        (acc, job) => acc + job.workerCount,
        0,
      ),
    });
  }

  for (const fn of parsedFunctions) {
    const existingSector = existingBySector.get(sectorKey(fn.sectorName));
    const existingJob = existingSector?.jobs.get(sectorKey(fn.name));
    const row: PgroDiffRow = {
      name: existingJob?.name ?? fn.name,
      sectorName: existingSector?.name ?? fn.sectorName,
      workerCount: existingJob?.workerCount ?? 0,
    };
    if (!existingJob) {
      functionsAdded.push(row);
    } else if (!existingJob.isActive) {
      functionsReactivated.push(row);
    } else {
      functionsKept.push(row);
    }
  }

  for (const existing of existingBySector.values()) {
    for (const job of existing.jobs.values()) {
      const key = functionKey(existing.name, job.name);
      if (parsedFunctionKeys.has(key)) continue;
      if (!job.isActive) continue;
      functionsToArchive.push({
        name: job.name,
        sectorName: existing.name,
        workerCount: job.workerCount,
      });
    }
  }

  const byName = (a: PgroDiffRow, b: PgroDiffRow) =>
    `${a.sectorName ?? ''} ${a.name}`.localeCompare(
      `${b.sectorName ?? ''} ${b.name}`,
      'pt-BR',
    );

  return {
    sectorsAdded: sectorsAdded.sort(byName),
    sectorsKept: sectorsKept.sort(byName),
    sectorsReactivated: sectorsReactivated.sort(byName),
    sectorsToArchive: sectorsToArchive.sort(byName),
    functionsAdded: functionsAdded.sort(byName),
    functionsKept: functionsKept.sort(byName),
    functionsReactivated: functionsReactivated.sort(byName),
    functionsToArchive: functionsToArchive.sort(byName),
  };
}
