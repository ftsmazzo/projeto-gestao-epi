-- CreateEnum
CREATE TYPE "PgroImportStatus" AS ENUM ('PENDING', 'PARSED', 'CONFIRMED', 'FAILED');

-- CreateTable
CREATE TABLE "PgroImportRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "servedClientId" TEXT,
    "status" "PgroImportStatus" NOT NULL DEFAULT 'PENDING',
    "fileName" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "companyData" JSONB,
    "extractedSectors" JSONB,
    "extractedFunctions" JSONB,
    "extractedRisks" JSONB,
    "extractedEpiNeeds" JSONB,
    "warnings" JSONB,
    "confirmSummary" JSONB,
    "errorMessage" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PgroImportRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PgroImportRun_organizationId_idx" ON "PgroImportRun"("organizationId");
CREATE INDEX "PgroImportRun_servedClientId_idx" ON "PgroImportRun"("servedClientId");
CREATE INDEX "PgroImportRun_status_idx" ON "PgroImportRun"("status");
CREATE INDEX "PgroImportRun_createdAt_idx" ON "PgroImportRun"("createdAt");

-- AddForeignKey
ALTER TABLE "PgroImportRun" ADD CONSTRAINT "PgroImportRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PgroImportRun" ADD CONSTRAINT "PgroImportRun_servedClientId_fkey" FOREIGN KEY ("servedClientId") REFERENCES "ServedClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PgroImportRun" ADD CONSTRAINT "PgroImportRun_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
