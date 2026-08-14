-- CreateEnum
CREATE TYPE "PgroExtractionAliasKind" AS ENUM ('SECTOR', 'JOB_FUNCTION', 'RISK', 'EPI_NEED', 'LAYOUT_HINT');

-- AlterTable
ALTER TABLE "PgroImportRun" ADD COLUMN "parseMeta" JSONB;

-- CreateTable
CREATE TABLE "PgroExtractionAlias" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kind" "PgroExtractionAliasKind" NOT NULL,
    "rawNormalized" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "category" "OccupationalRiskCategory",
    "hitCount" INTEGER NOT NULL DEFAULT 1,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PgroExtractionAlias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PgroExtractionAlias_organizationId_kind_idx" ON "PgroExtractionAlias"("organizationId", "kind");

-- CreateIndex
CREATE INDEX "PgroExtractionAlias_organizationId_lastSeenAt_idx" ON "PgroExtractionAlias"("organizationId", "lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "PgroExtractionAlias_organizationId_kind_rawNormalized_key" ON "PgroExtractionAlias"("organizationId", "kind", "rawNormalized");

-- AddForeignKey
ALTER TABLE "PgroExtractionAlias" ADD CONSTRAINT "PgroExtractionAlias_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
