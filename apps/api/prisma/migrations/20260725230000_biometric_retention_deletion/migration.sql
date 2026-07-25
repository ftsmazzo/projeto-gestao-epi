-- AlterEnum
ALTER TYPE "WorkerBiometricDeletionStatus" ADD VALUE 'FAILED';

-- AlterTable WorkerFacialReference
ALTER TABLE "WorkerFacialReference" ALTER COLUMN "filePath" DROP NOT NULL;
ALTER TABLE "WorkerFacialReference" ADD COLUMN "deletionError" TEXT,
ADD COLUMN "deletedByUserId" TEXT;

-- AlterTable DeliveryEvidence
ALTER TABLE "DeliveryEvidence" ALTER COLUMN "filePath" DROP NOT NULL;
ALTER TABLE "DeliveryEvidence" ADD COLUMN "retentionUntil" TIMESTAMP(3),
ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "deletionStatus" "WorkerBiometricDeletionStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN "deletionError" TEXT,
ADD COLUMN "deletedByUserId" TEXT;

-- CreateIndex
CREATE INDEX "DeliveryEvidence_retentionUntil_idx" ON "DeliveryEvidence"("retentionUntil");
CREATE INDEX "DeliveryEvidence_deletionStatus_idx" ON "DeliveryEvidence"("deletionStatus");

-- AddForeignKey
ALTER TABLE "WorkerFacialReference" ADD CONSTRAINT "WorkerFacialReference_deletedByUserId_fkey" FOREIGN KEY ("deletedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DeliveryEvidence" ADD CONSTRAINT "DeliveryEvidence_deletedByUserId_fkey" FOREIGN KEY ("deletedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
