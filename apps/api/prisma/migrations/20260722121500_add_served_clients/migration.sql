-- CreateEnum
CREATE TYPE "ServedClientStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "ServedClient" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "tradeName" TEXT,
    "cnpj" TEXT NOT NULL,
    "status" "ServedClientStatus" NOT NULL DEFAULT 'ACTIVE',
    "allocatedLifeQuota" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServedClient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServedClient_organizationId_idx" ON "ServedClient"("organizationId");

-- CreateIndex
CREATE INDEX "ServedClient_status_idx" ON "ServedClient"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ServedClient_organizationId_cnpj_key" ON "ServedClient"("organizationId", "cnpj");

-- AddForeignKey
ALTER TABLE "ServedClient" ADD CONSTRAINT "ServedClient_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
