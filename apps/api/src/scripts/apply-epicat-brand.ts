/**
 * Renomeia a distribuidora de teste para EPICAT e grava o logo no volume.
 * Uso (container): BOOTSTRAP_EPICAT_BRAND=1 node dist/scripts/apply-epicat-brand.js
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { OrganizationKind, PrismaClient } from '@prisma/client';
import { saveOrgLogoFile } from '../organization/org-logo.storage';

const TARGET_NAME = 'EPICAT Distribuidora';
const MATCH_NAMES = ['Distribuidora Teste', 'DISTRIBUIDORA TESTE', 'distribuidora teste'];

function resolveLogoPath() {
  const candidates = [
    join(__dirname, '..', '..', 'assets', 'branding', 'epicat-logo.png'),
    join(process.cwd(), 'assets', 'branding', 'epicat-logo.png'),
    join(process.cwd(), '..', 'assets', 'branding', 'epicat-logo.png'),
  ];
  return candidates.find((path) => existsSync(path)) ?? null;
}

async function main() {
  const prisma = new PrismaClient();
  try {
    let organization = await prisma.organization.findFirst({
      where: {
        kind: OrganizationKind.DISTRIBUIDORA,
        OR: MATCH_NAMES.map((name) => ({
          name: { equals: name, mode: 'insensitive' as const },
        })),
      },
    });

    if (!organization) {
      const distributors = await prisma.organization.findMany({
        where: { kind: OrganizationKind.DISTRIBUIDORA },
        orderBy: { createdAt: 'asc' },
      });
      if (distributors.length === 1) {
        organization = distributors[0] ?? null;
      }
    }

    if (!organization) {
      console.error(
        '[epicat-brand] Nenhuma organizacao DISTRIBUIDORA candidata encontrada.',
      );
      process.exitCode = 1;
      return;
    }

    const logoPath = resolveLogoPath();
    if (!logoPath) {
      console.error('[epicat-brand] Arquivo epicat-logo.png nao encontrado.');
      process.exitCode = 1;
      return;
    }

    const buffer = readFileSync(logoPath);
    const saved = await saveOrgLogoFile({
      organizationId: organization.id,
      buffer,
      mimeType: 'image/png',
      originalName: 'epicat-logo.png',
    });

    const updated = await prisma.organization.update({
      where: { id: organization.id },
      data: {
        name: TARGET_NAME,
        logoPath: saved.relativePath,
        logoMimeType: saved.mimeType,
      },
    });

    console.log(
      `[epicat-brand] OK: ${organization.name} -> ${updated.name} (logo ${saved.relativePath})`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error('[epicat-brand] Falha:', error);
  process.exitCode = 1;
});
