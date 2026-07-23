-- CreateEnum
CREATE TYPE "EpiRequirementSource" AS ENUM ('MANUAL', 'PGRO', 'IMPORT');

-- CreateTable
CREATE TABLE "JobFunctionEpiRequirement" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "jobFunctionId" TEXT NOT NULL,
    "riskId" TEXT,
    "epiNeedId" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "replacementIntervalDays" INTEGER,
    "notes" TEXT,
    "source" "EpiRequirementSource" NOT NULL DEFAULT 'MANUAL',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobFunctionEpiRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobFunctionEpiRequirement_organizationId_idx" ON "JobFunctionEpiRequirement"("organizationId");
CREATE INDEX "JobFunctionEpiRequirement_jobFunctionId_idx" ON "JobFunctionEpiRequirement"("jobFunctionId");
CREATE INDEX "JobFunctionEpiRequirement_riskId_idx" ON "JobFunctionEpiRequirement"("riskId");
CREATE INDEX "JobFunctionEpiRequirement_epiNeedId_idx" ON "JobFunctionEpiRequirement"("epiNeedId");
CREATE INDEX "JobFunctionEpiRequirement_isActive_idx" ON "JobFunctionEpiRequirement"("isActive");

-- Unique among active rows: funcao + risco (opcional) + necessidade
CREATE UNIQUE INDEX "JobFunctionEpiRequirement_active_unique_uidx"
ON "JobFunctionEpiRequirement" ("organizationId", "jobFunctionId", (COALESCE("riskId", '')), "epiNeedId")
WHERE "isActive" = true;

-- AddForeignKey
ALTER TABLE "JobFunctionEpiRequirement" ADD CONSTRAINT "JobFunctionEpiRequirement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobFunctionEpiRequirement" ADD CONSTRAINT "JobFunctionEpiRequirement_jobFunctionId_fkey" FOREIGN KEY ("jobFunctionId") REFERENCES "ClientJobFunction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobFunctionEpiRequirement" ADD CONSTRAINT "JobFunctionEpiRequirement_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "OccupationalRisk"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "JobFunctionEpiRequirement" ADD CONSTRAINT "JobFunctionEpiRequirement_epiNeedId_fkey" FOREIGN KEY ("epiNeedId") REFERENCES "EpiNeed"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
