/**
 * Zera operacao de teste da EPICAT Distribuidora.
 * Mantem usuarios, memberships, marca e perfil fiscal.
 *
 * Uso: BOOTSTRAP_EPICAT_WIPE=1 node dist/scripts/wipe-epicat-ops.js
 */
import { OrganizationKind, PrismaClient } from '@prisma/client';
import { rm } from 'fs/promises';
import { join } from 'path';
import { getDistributorInboundRoot } from '../distributor/distributor-document.storage';
import { wipeDistributorOperationalData } from '../distributor/distributor-reset.rules';

async function main() {
  const prisma = new PrismaClient();
  try {
    const organization = await prisma.organization.findFirst({
      where: {
        kind: OrganizationKind.DISTRIBUIDORA,
        OR: [
          { name: { equals: 'EPICAT Distribuidora', mode: 'insensitive' } },
          { name: { contains: 'EPICAT', mode: 'insensitive' } },
          { name: { equals: 'Distribuidora Teste', mode: 'insensitive' } },
        ],
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!organization) {
      console.error('[epicat-wipe] Organizacao distribuidora nao encontrada.');
      process.exitCode = 1;
      return;
    }

    const summary = await prisma.$transaction((tx) =>
      wipeDistributorOperationalData(tx, organization.id),
    );

    await rm(join(getDistributorInboundRoot(), organization.id), {
      recursive: true,
      force: true,
    }).catch(() => undefined);

    console.log(
      `[epicat-wipe] OK ${organization.name}: produtos=${summary.products} movimentos=${summary.movements} notas=${summary.inboundDocuments} fornecedores=${summary.suppliers} clientes=${summary.customers}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error('[epicat-wipe] Falha:', error);
  process.exitCode = 1;
});
