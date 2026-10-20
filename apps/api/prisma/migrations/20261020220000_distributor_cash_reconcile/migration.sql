-- AlterTable
ALTER TABLE "DistributorCashMovement" ADD COLUMN "reconciledAt" TIMESTAMP(3);
ALTER TABLE "DistributorCashMovement" ADD COLUMN "reconciledByUserId" TEXT;

-- CreateIndex
CREATE INDEX "DistributorCashMovement_bankAccountId_reconciledAt_idx" ON "DistributorCashMovement"("bankAccountId", "reconciledAt");
