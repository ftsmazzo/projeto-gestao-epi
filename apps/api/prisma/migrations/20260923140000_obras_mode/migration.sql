-- Modulo Obras: flag por cliente + obras + vinculos temporais trabalhador↔ obra.
-- Obra NAO encerra sozinha ao passar plannedEndAt; apenas lembrete (≤15 dias).

ALTER TABLE "ServedClient" ADD COLUMN "obrasModeEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TYPE "ClientWorkSiteStatus" AS ENUM ('ACTIVE', 'FINISHED');

CREATE TABLE "ClientWorkSite" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "servedClientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "cnpj" TEXT,
    "addressLine" TEXT,
    "city" TEXT,
    "state" TEXT,
    "plannedStartAt" TIMESTAMP(3),
    "plannedEndAt" TIMESTAMP(3),
    "status" "ClientWorkSiteStatus" NOT NULL DEFAULT 'ACTIVE',
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientWorkSite_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkerWorkAssignment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "servedClientId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "workSiteId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkerWorkAssignment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClientWorkSite_organizationId_idx" ON "ClientWorkSite"("organizationId");
CREATE INDEX "ClientWorkSite_servedClientId_idx" ON "ClientWorkSite"("servedClientId");
CREATE INDEX "ClientWorkSite_status_idx" ON "ClientWorkSite"("status");
CREATE INDEX "ClientWorkSite_plannedEndAt_idx" ON "ClientWorkSite"("plannedEndAt");

CREATE INDEX "WorkerWorkAssignment_organizationId_idx" ON "WorkerWorkAssignment"("organizationId");
CREATE INDEX "WorkerWorkAssignment_servedClientId_idx" ON "WorkerWorkAssignment"("servedClientId");
CREATE INDEX "WorkerWorkAssignment_workerId_endAt_idx" ON "WorkerWorkAssignment"("workerId", "endAt");
CREATE INDEX "WorkerWorkAssignment_workSiteId_idx" ON "WorkerWorkAssignment"("workSiteId");
CREATE INDEX "WorkerWorkAssignment_startAt_endAt_idx" ON "WorkerWorkAssignment"("startAt", "endAt");

ALTER TABLE "ClientWorkSite" ADD CONSTRAINT "ClientWorkSite_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientWorkSite" ADD CONSTRAINT "ClientWorkSite_servedClientId_fkey" FOREIGN KEY ("servedClientId") REFERENCES "ServedClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkerWorkAssignment" ADD CONSTRAINT "WorkerWorkAssignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkerWorkAssignment" ADD CONSTRAINT "WorkerWorkAssignment_servedClientId_fkey" FOREIGN KEY ("servedClientId") REFERENCES "ServedClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkerWorkAssignment" ADD CONSTRAINT "WorkerWorkAssignment_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkerWorkAssignment" ADD CONSTRAINT "WorkerWorkAssignment_workSiteId_fkey" FOREIGN KEY ("workSiteId") REFERENCES "ClientWorkSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
