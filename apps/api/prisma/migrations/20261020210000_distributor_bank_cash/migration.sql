-- CreateEnum
CREATE TYPE "DistributorCashDirection" AS ENUM ('IN', 'OUT');
CREATE TYPE "DistributorCashSource" AS ENUM ('OPENING', 'MANUAL', 'PAYABLE', 'RECEIVABLE');

-- CreateTable
CREATE TABLE "DistributorBankAccount" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bankCode" TEXT,
    "agency" TEXT,
    "number" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DistributorBankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DistributorCashMovement" (
    "id" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "direction" "DistributorCashDirection" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "source" "DistributorCashSource" NOT NULL,
    "note" TEXT,
    "payableId" TEXT,
    "receivableId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DistributorCashMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DistributorBankAccount_organizationId_active_idx" ON "DistributorBankAccount"("organizationId", "active");
CREATE UNIQUE INDEX "DistributorCashMovement_payableId_key" ON "DistributorCashMovement"("payableId");
CREATE UNIQUE INDEX "DistributorCashMovement_receivableId_key" ON "DistributorCashMovement"("receivableId");
CREATE INDEX "DistributorCashMovement_bankAccountId_createdAt_idx" ON "DistributorCashMovement"("bankAccountId", "createdAt");

-- AddForeignKey
ALTER TABLE "DistributorBankAccount" ADD CONSTRAINT "DistributorBankAccount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DistributorCashMovement" ADD CONSTRAINT "DistributorCashMovement_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "DistributorBankAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DistributorCashMovement" ADD CONSTRAINT "DistributorCashMovement_payableId_fkey" FOREIGN KEY ("payableId") REFERENCES "DistributorPayable"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DistributorCashMovement" ADD CONSTRAINT "DistributorCashMovement_receivableId_fkey" FOREIGN KEY ("receivableId") REFERENCES "DistributorReceivable"("id") ON DELETE SET NULL ON UPDATE CASCADE;
