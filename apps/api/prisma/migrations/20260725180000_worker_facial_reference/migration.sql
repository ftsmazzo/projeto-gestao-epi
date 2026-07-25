-- AlterEnum
ALTER TYPE "DeliveryEvidenceVerificationStatus" ADD VALUE 'HUMAN_CONFIRMED';

-- CreateEnum
CREATE TYPE "WorkerFacialReferenceStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateTable
CREATE TABLE "WorkerFacialReference" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "servedClientId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileHash" TEXT,
    "mimeType" TEXT,
    "byteSize" INTEGER,
    "status" "WorkerFacialReferenceStatus" NOT NULL DEFAULT 'ACTIVE',
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,
    "consentText" TEXT,
    "consentAcceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkerFacialReference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkerFacialReference_organizationId_idx" ON "WorkerFacialReference"("organizationId");

-- CreateIndex
CREATE INDEX "WorkerFacialReference_servedClientId_idx" ON "WorkerFacialReference"("servedClientId");

-- CreateIndex
CREATE INDEX "WorkerFacialReference_workerId_idx" ON "WorkerFacialReference"("workerId");

-- CreateIndex
CREATE INDEX "WorkerFacialReference_status_idx" ON "WorkerFacialReference"("status");

-- CreateIndex
CREATE INDEX "WorkerFacialReference_uploadedAt_idx" ON "WorkerFacialReference"("uploadedAt");

-- AddForeignKey
ALTER TABLE "WorkerFacialReference" ADD CONSTRAINT "WorkerFacialReference_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerFacialReference" ADD CONSTRAINT "WorkerFacialReference_servedClientId_fkey" FOREIGN KEY ("servedClientId") REFERENCES "ServedClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerFacialReference" ADD CONSTRAINT "WorkerFacialReference_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerFacialReference" ADD CONSTRAINT "WorkerFacialReference_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
