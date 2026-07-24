import type { Prisma } from '@prisma/client';

export type MatrizClientSource = {
  id: string;
  legalName: string;
  tradeName?: string | null;
  cnpj: string;
};

type UnitDb = {
  operationalUnit: {
    findFirst: (args: {
      where: Prisma.OperationalUnitWhereInput;
      select?: { id?: true; code?: true; cnpj?: true; notes?: true };
    }) => Promise<{
      id: string;
      code: string | null;
      cnpj: string | null;
      notes: string | null;
    } | null>;
    create: (args: {
      data: {
        organizationId: string;
        servedClientId: string;
        name: string;
        code: string | null;
        cnpj: string | null;
        notes: string | null;
        status: 'ACTIVE';
      };
    }) => Promise<{ id: string }>;
    update: (args: {
      where: { id: string };
      data: {
        code?: string;
        cnpj?: string | null;
        notes?: string | null;
      };
    }) => Promise<{ id: string }>;
  };
};

/**
 * Garante unidade operacional Matriz para o cliente (idempotente).
 * Preenche code/cnpj/notes vazios quando houver dados melhores.
 */
export async function ensureMatrizOperationalUnit(
  db: UnitDb,
  organizationId: string,
  client: MatrizClientSource,
): Promise<{ id: string; created: boolean }> {
  const existing = await db.operationalUnit.findFirst({
    where: {
      organizationId,
      servedClientId: client.id,
      OR: [
        { code: { equals: 'MATRIZ', mode: 'insensitive' } },
        { name: { equals: 'Matriz', mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      code: true,
      cnpj: true,
      notes: true,
    },
  });

  const displayName = client.tradeName?.trim() || client.legalName.trim();
  const desiredNotes = `Unidade Matriz de ${displayName}`;

  let cnpjForMatriz: string | null = client.cnpj || null;
  if (cnpjForMatriz) {
    const cnpjOwner = await db.operationalUnit.findFirst({
      where: {
        organizationId,
        cnpj: cnpjForMatriz,
        ...(existing ? { NOT: { id: existing.id } } : {}),
      },
      select: { id: true, code: true, cnpj: true, notes: true },
    });
    if (cnpjOwner) {
      cnpjForMatriz = null;
    }
  }

  if (existing) {
    const data: {
      code?: string;
      cnpj?: string | null;
      notes?: string | null;
    } = {};
    if (!existing.code) data.code = 'MATRIZ';
    if (!existing.cnpj && cnpjForMatriz) data.cnpj = cnpjForMatriz;
    if (!existing.notes) data.notes = desiredNotes;
    if (Object.keys(data).length > 0) {
      await db.operationalUnit.update({
        where: { id: existing.id },
        data,
      });
    }
    return { id: existing.id, created: false };
  }

  const codeOwner = await db.operationalUnit.findFirst({
    where: {
      servedClientId: client.id,
      code: { equals: 'MATRIZ', mode: 'insensitive' },
    },
    select: { id: true, code: true, cnpj: true, notes: true },
  });

  const created = await db.operationalUnit.create({
    data: {
      organizationId,
      servedClientId: client.id,
      name: 'Matriz',
      code: codeOwner ? null : 'MATRIZ',
      cnpj: cnpjForMatriz,
      notes: desiredNotes,
      status: 'ACTIVE',
    },
  });

  return { id: created.id, created: true };
}
