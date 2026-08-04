/**
 * Auditoria de prontidao para ensaio de piloto (entrega facial).
 * Uso (em apps/api): npx --yes tsx scripts/audit-pilot-readiness.ts
 * Nao imprime CPF nem dados biometricos.
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { Prisma, PrismaClient } from '@prisma/client';

function loadEnvFile(path: string) {
  try {
    const raw = readFileSync(path, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const i = trimmed.indexOf('=');
      if (i < 0) continue;
      const key = trimmed.slice(0, i).trim();
      let val = trimmed.slice(i + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // arquivo opcional
  }
}

loadEnvFile(resolve(__dirname, '../../../.env'));
loadEnvFile(resolve(__dirname, '../.env'));

const prisma = new PrismaClient();

type Check = {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
  required: boolean;
};

async function auditClient(
  organizationId: string,
  clientId: string,
  tradeName: string,
  legalName: string,
  status: string,
  allocatedLifeQuota: number,
) {
  const [
    unitsActive,
    workersActive,
    workersTotal,
    sectorsActive,
    jobsActive,
    epiRequirements,
    portalUsersActive,
    managersActive,
    stockOpsActive,
    stockLocations,
    stockQty,
    lastPgro,
    deliveries,
    workersReady,
    workersWithConsent,
    workersWithFace,
    workersWithJob,
    epiNeedsViaReq,
    itemsLinked,
  ] = await Promise.all([
    prisma.operationalUnit.count({
      where: { organizationId, servedClientId: clientId, status: 'ACTIVE' },
    }),
    prisma.worker.count({
      where: { organizationId, servedClientId: clientId, status: 'ACTIVE' },
    }),
    prisma.worker.count({
      where: { organizationId, servedClientId: clientId },
    }),
    prisma.clientSector.count({
      where: { organizationId, servedClientId: clientId, isActive: true },
    }),
    prisma.clientJobFunction.count({
      where: { organizationId, servedClientId: clientId, isActive: true },
    }),
    prisma.jobFunctionEpiRequirement.count({
      where: {
        organizationId,
        isActive: true,
        jobFunction: { servedClientId: clientId },
      },
    }),
    prisma.clientUserMembership.count({
      where: { organizationId, servedClientId: clientId, isActive: true },
    }),
    prisma.clientUserMembership.count({
      where: {
        organizationId,
        servedClientId: clientId,
        isActive: true,
        role: 'CLIENT_MANAGER',
      },
    }),
    prisma.clientUserMembership.count({
      where: {
        organizationId,
        servedClientId: clientId,
        isActive: true,
        role: 'STOCK_OPERATOR',
      },
    }),
    prisma.stockLocation.count({
      where: { organizationId, servedClientId: clientId, isActive: true },
    }),
    prisma.epiStockBalance.aggregate({
      where: {
        organizationId,
        stockLocation: { servedClientId: clientId },
      },
      _sum: { quantity: true },
      _count: { _all: true },
    }),
    prisma.pgroImportRun.findFirst({
      where: { organizationId, servedClientId: clientId },
      orderBy: { createdAt: 'desc' },
      select: { status: true, fileName: true, createdAt: true },
    }),
    prisma.epiDelivery.count({
      where: { organizationId, servedClientId: clientId },
    }),
    prisma.worker.count({
      where: {
        organizationId,
        servedClientId: clientId,
        status: 'ACTIVE',
        clientJobFunctionId: { not: null },
        biometricConsents: { some: { status: 'GRANTED' } },
        facialReferences: {
          some: {
            status: 'ACTIVE',
            faceDescriptor: { not: Prisma.DbNull },
          },
        },
      },
    }),
    prisma.worker.count({
      where: {
        organizationId,
        servedClientId: clientId,
        status: 'ACTIVE',
        biometricConsents: { some: { status: 'GRANTED' } },
      },
    }),
    prisma.worker.count({
      where: {
        organizationId,
        servedClientId: clientId,
        status: 'ACTIVE',
        facialReferences: { some: { status: 'ACTIVE' } },
      },
    }),
    prisma.worker.count({
      where: {
        organizationId,
        servedClientId: clientId,
        status: 'ACTIVE',
        clientJobFunctionId: { not: null },
      },
    }),
    prisma.epiNeed.count({
      where: {
        organizationId,
        isActive: true,
        jobRequirements: {
          some: { jobFunction: { servedClientId: clientId }, isActive: true },
        },
      },
    }),
    prisma.epiItemNeed.count({
      where: {
        organizationId,
        epiNeed: {
          isActive: true,
          jobRequirements: {
            some: { jobFunction: { servedClientId: clientId }, isActive: true },
          },
        },
        epiItem: { isActive: true },
      },
    }),
  ]);

  const stockSum = stockQty._sum.quantity ?? 0;
  const structureOk = sectorsActive > 0 || jobsActive > 0 || epiNeedsViaReq > 0;

  const checks: Check[] = [
    {
      key: 'active',
      label: 'Cliente ACTIVE',
      ok: status === 'ACTIVE',
      detail: status,
      required: true,
    },
    {
      key: 'units',
      label: 'Unidade operacional',
      ok: unitsActive > 0,
      detail: `${unitsActive} ativa(s)`,
      required: true,
    },
    {
      key: 'structure',
      label: 'Estrutura (setor/funcao/necessidade)',
      ok: structureOk,
      detail: `${sectorsActive} setores, ${jobsActive} funcoes, ${epiNeedsViaReq} necessidades, ${epiRequirements} requisitos`,
      required: true,
    },
    {
      key: 'workers',
      label: 'Trabalhadores ACTIVE',
      ok: workersActive > 0,
      detail: `${workersActive} ativos / ${workersTotal} total (cota ${allocatedLifeQuota})`,
      required: true,
    },
    {
      key: 'job_link',
      label: 'Trabalhador com funcao',
      ok: workersWithJob > 0,
      detail: `${workersWithJob} com funcao`,
      required: true,
    },
    {
      key: 'portal_users',
      label: 'Usuario do portal',
      ok: portalUsersActive > 0,
      detail: `${managersActive} gestor(es), ${stockOpsActive} op. estoque`,
      required: true,
    },
    {
      key: 'stock_location',
      label: 'Local de estoque do cliente',
      ok: stockLocations > 0,
      detail: `${stockLocations} local(is)`,
      required: true,
    },
    {
      key: 'stock_qty',
      label: 'Saldo de estoque > 0',
      ok: stockSum > 0,
      detail: `${stockSum} un. em ${stockQty._count._all} saldo(s)`,
      required: true,
    },
    {
      key: 'epi_linked',
      label: 'Necessidade com EPI real (CA)',
      ok: itemsLinked > 0,
      detail: `${itemsLinked} vinculo(s) EpiItemNeed`,
      required: true,
    },
    {
      key: 'consent',
      label: 'Consentimento biometrico GRANTED',
      ok: workersWithConsent > 0,
      detail: `${workersWithConsent} trabalhador(es)`,
      required: true,
    },
    {
      key: 'face',
      label: 'Template facial ACTIVE',
      ok: workersWithFace > 0,
      detail: `${workersWithFace} trabalhador(es)`,
      required: true,
    },
    {
      key: 'delivery_ready',
      label: 'Pronto p/ 1 entrega facial',
      ok:
        workersReady > 0 &&
        stockSum > 0 &&
        itemsLinked > 0 &&
        portalUsersActive > 0 &&
        status === 'ACTIVE',
      detail: `${workersReady} trabalhador(es) com consent+face+funcao`,
      required: true,
    },
    {
      key: 'pgro',
      label: 'PGRO importado',
      ok: Boolean(lastPgro),
      detail: lastPgro
        ? `${lastPgro.status} · ${lastPgro.fileName} · ${lastPgro.createdAt.toISOString().slice(0, 10)}`
        : 'nenhum',
      required: false,
    },
    {
      key: 'deliveries',
      label: 'Entregas ja registradas',
      ok: deliveries > 0,
      detail: `${deliveries} entrega(s)`,
      required: false,
    },
  ];

  const requiredChecks = checks.filter((c) => c.required);
  const score =
    requiredChecks.filter((c) => c.ok).length / requiredChecks.length;

  return {
    id: clientId,
    name: tradeName || legalName,
    legalName,
    status,
    score: Math.round(score * 100),
    requiredFail: requiredChecks.filter((c) => !c.ok).length,
    readyForPanel:
      status === 'ACTIVE' &&
      structureOk &&
      workersActive > 0 &&
      portalUsersActive > 0,
    readyForDelivery: checks.find((c) => c.key === 'delivery_ready')!.ok,
    checks,
  };
}

async function main() {
  const orgs = await prisma.organization.findMany({
    select: { id: true, name: true, slug: true },
    orderBy: { createdAt: 'asc' },
  });

  const report: Awaited<ReturnType<typeof auditClient>>[] = [];

  for (const org of orgs) {
    const clients = await prisma.servedClient.findMany({
      where: { organizationId: org.id },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        tradeName: true,
        legalName: true,
        status: true,
        allocatedLifeQuota: true,
      },
    });

    for (const c of clients) {
      report.push({
        organization: org.name,
        organizationSlug: org.slug,
        ...(await auditClient(
          org.id,
          c.id,
          c.tradeName,
          c.legalName,
          c.status,
          c.allocatedLifeQuota,
        )),
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        organizations: orgs.map((o) => ({ name: o.name, slug: o.slug })),
        clients: report,
      },
      null,
      2,
    ),
  );

  const outPath = resolve(__dirname, '../../../pilot-audit.json');
  const { writeFileSync } = await import('fs');
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        organizations: orgs.map((o) => ({ name: o.name, slug: o.slug })),
        clients: report,
      },
      null,
      2,
    ),
    'utf8',
  );
  console.error(`Wrote ${outPath}`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
