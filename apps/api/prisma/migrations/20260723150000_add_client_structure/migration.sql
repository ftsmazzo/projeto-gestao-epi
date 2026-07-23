-- CreateEnum
CREATE TYPE "OccupationalRiskCategory" AS ENUM ('FISICO', 'QUIMICO', 'BIOLOGICO', 'ERGONOMICO', 'MECANICO', 'ACIDENTE', 'PSICOSSOCIAL', 'OUTROS');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('MUITO_BAIXO', 'BAIXO', 'MODERADO', 'ALTO', 'MUITO_ALTO');

-- CreateTable
CREATE TABLE "ClientSector" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "servedClientId" TEXT NOT NULL,
    "operationalUnitId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientSector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientJobFunction" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "servedClientId" TEXT NOT NULL,
    "sectorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "environmentDescription" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientJobFunction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OccupationalRisk" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "OccupationalRiskCategory" NOT NULL,
    "description" TEXT,
    "aliases" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OccupationalRisk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobFunctionRisk" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "jobFunctionId" TEXT NOT NULL,
    "riskId" TEXT NOT NULL,
    "exposure" TEXT,
    "source" TEXT,
    "possibleDamage" TEXT,
    "riskLevel" "RiskLevel",
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobFunctionRisk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientSector_organizationId_idx" ON "ClientSector"("organizationId");
CREATE INDEX "ClientSector_servedClientId_idx" ON "ClientSector"("servedClientId");
CREATE INDEX "ClientSector_operationalUnitId_idx" ON "ClientSector"("operationalUnitId");
CREATE INDEX "ClientSector_isActive_idx" ON "ClientSector"("isActive");
CREATE UNIQUE INDEX "ClientSector_client_unit_name_ci_uidx"
ON "ClientSector" ("organizationId", "servedClientId", (COALESCE("operationalUnitId", '')), (LOWER("name")));

-- CreateIndex
CREATE INDEX "ClientJobFunction_organizationId_idx" ON "ClientJobFunction"("organizationId");
CREATE INDEX "ClientJobFunction_servedClientId_idx" ON "ClientJobFunction"("servedClientId");
CREATE INDEX "ClientJobFunction_sectorId_idx" ON "ClientJobFunction"("sectorId");
CREATE INDEX "ClientJobFunction_isActive_idx" ON "ClientJobFunction"("isActive");
CREATE UNIQUE INDEX "ClientJobFunction_sector_name_ci_uidx"
ON "ClientJobFunction" ("organizationId", "sectorId", (LOWER("name")));

-- CreateIndex
CREATE INDEX "OccupationalRisk_organizationId_idx" ON "OccupationalRisk"("organizationId");
CREATE INDEX "OccupationalRisk_category_idx" ON "OccupationalRisk"("category");
CREATE INDEX "OccupationalRisk_isActive_idx" ON "OccupationalRisk"("isActive");
CREATE UNIQUE INDEX "OccupationalRisk_org_name_category_ci_uidx"
ON "OccupationalRisk" ("organizationId", "category", (LOWER("name")));

-- CreateIndex
CREATE INDEX "JobFunctionRisk_organizationId_idx" ON "JobFunctionRisk"("organizationId");
CREATE INDEX "JobFunctionRisk_jobFunctionId_idx" ON "JobFunctionRisk"("jobFunctionId");
CREATE INDEX "JobFunctionRisk_riskId_idx" ON "JobFunctionRisk"("riskId");
CREATE UNIQUE INDEX "JobFunctionRisk_organizationId_jobFunctionId_riskId_key" ON "JobFunctionRisk"("organizationId", "jobFunctionId", "riskId");

-- AddForeignKey
ALTER TABLE "ClientSector" ADD CONSTRAINT "ClientSector_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientSector" ADD CONSTRAINT "ClientSector_servedClientId_fkey" FOREIGN KEY ("servedClientId") REFERENCES "ServedClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientSector" ADD CONSTRAINT "ClientSector_operationalUnitId_fkey" FOREIGN KEY ("operationalUnitId") REFERENCES "OperationalUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ClientJobFunction" ADD CONSTRAINT "ClientJobFunction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientJobFunction" ADD CONSTRAINT "ClientJobFunction_servedClientId_fkey" FOREIGN KEY ("servedClientId") REFERENCES "ServedClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientJobFunction" ADD CONSTRAINT "ClientJobFunction_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "ClientSector"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OccupationalRisk" ADD CONSTRAINT "OccupationalRisk_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JobFunctionRisk" ADD CONSTRAINT "JobFunctionRisk_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobFunctionRisk" ADD CONSTRAINT "JobFunctionRisk_jobFunctionId_fkey" FOREIGN KEY ("jobFunctionId") REFERENCES "ClientJobFunction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobFunctionRisk" ADD CONSTRAINT "JobFunctionRisk_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "OccupationalRisk"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
