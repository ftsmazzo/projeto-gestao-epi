-- Contato institucional do cliente atendido (alertas/cobrancas).
ALTER TABLE "ServedClient" ADD COLUMN "contactEmail" TEXT;
ALTER TABLE "ServedClient" ADD COLUMN "contactPhone" TEXT;

-- Contatos oficiais da consultoria para comunicacao com clientes.
CREATE TYPE "OrganizationContactRole" AS ENUM ('SUPPORT', 'COMMERCIAL', 'BILLING', 'OPERATIONS');

CREATE TABLE "OrganizationContact" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "role" "OrganizationContactRole" NOT NULL DEFAULT 'SUPPORT',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationContact_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrganizationContact_organizationId_idx" ON "OrganizationContact"("organizationId");
CREATE INDEX "OrganizationContact_organizationId_role_idx" ON "OrganizationContact"("organizationId", "role");
CREATE INDEX "OrganizationContact_organizationId_isPrimary_idx" ON "OrganizationContact"("organizationId", "isPrimary");

ALTER TABLE "OrganizationContact" ADD CONSTRAINT "OrganizationContact_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
