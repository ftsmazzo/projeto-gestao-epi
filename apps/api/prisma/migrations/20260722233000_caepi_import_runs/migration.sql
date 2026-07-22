-- CreateEnum
CREATE TYPE "CaepiImportRunStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "CaepiImportTriggeredBy" AS ENUM ('MANUAL', 'SCHEDULED', 'UPLOAD');

-- CreateTable
CREATE TABLE "CaepiImportRun" (
    "id" TEXT NOT NULL,
    "status" "CaepiImportRunStatus" NOT NULL DEFAULT 'PENDING',
    "triggeredBy" "CaepiImportTriggeredBy" NOT NULL,
    "sourceUrl" TEXT,
    "fileName" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "rowsRead" INTEGER,
    "certificatesCreated" INTEGER,
    "certificatesUpdated" INTEGER,
    "normsCreated" INTEGER,
    "rowsSkipped" INTEGER,
    "certificatesTotalAfter" INTEGER,
    "normsTotalAfter" INTEGER,
    "errorMessage" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaepiImportRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CaepiImportRun_status_idx" ON "CaepiImportRun"("status");

-- CreateIndex
CREATE INDEX "CaepiImportRun_triggeredBy_idx" ON "CaepiImportRun"("triggeredBy");

-- CreateIndex
CREATE INDEX "CaepiImportRun_createdAt_idx" ON "CaepiImportRun"("createdAt");

-- CreateIndex
CREATE INDEX "CaepiImportRun_startedAt_idx" ON "CaepiImportRun"("startedAt");

-- AddForeignKey
ALTER TABLE "CaepiImportRun" ADD CONSTRAINT "CaepiImportRun_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
