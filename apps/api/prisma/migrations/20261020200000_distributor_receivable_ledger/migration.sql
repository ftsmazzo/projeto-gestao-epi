-- CreateEnum
CREATE TYPE "DistributorReceivableStatus" AS ENUM ('OPEN', 'RECEIVED', 'CANCELLED');
CREATE TYPE "DistributorLedgerKind" AS ENUM ('ASSET', 'LIABILITY', 'REVENUE', 'EXPENSE');

-- AlterTable
ALTER TABLE "DistributorPayable" ADD COLUMN "accountId" TEXT;

-- CreateTable
CREATE TABLE "DistributorLedgerAccount" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "DistributorLedgerKind" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DistributorLedgerAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DistributorReceivable" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" "DistributorReceivableStatus" NOT NULL DEFAULT 'OPEN',
    "description" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerCnpj" TEXT,
    "amountCents" INTEGER NOT NULL,
    "dueOn" TIMESTAMP(3),
    "outboundInvoiceId" TEXT,
    "accountId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3),
    "receivedByUserId" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DistributorReceivable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DistributorLedgerAccount_organizationId_code_key" ON "DistributorLedgerAccount"("organizationId", "code");
CREATE INDEX "DistributorLedgerAccount_organizationId_kind_idx" ON "DistributorLedgerAccount"("organizationId", "kind");
CREATE UNIQUE INDEX "DistributorReceivable_outboundInvoiceId_key" ON "DistributorReceivable"("outboundInvoiceId");
CREATE INDEX "DistributorReceivable_organizationId_status_dueOn_idx" ON "DistributorReceivable"("organizationId", "status", "dueOn");
CREATE INDEX "DistributorReceivable_accountId_idx" ON "DistributorReceivable"("accountId");
CREATE INDEX "DistributorPayable_accountId_idx" ON "DistributorPayable"("accountId");

-- AddForeignKey
ALTER TABLE "DistributorPayable" ADD CONSTRAINT "DistributorPayable_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "DistributorLedgerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DistributorLedgerAccount" ADD CONSTRAINT "DistributorLedgerAccount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DistributorReceivable" ADD CONSTRAINT "DistributorReceivable_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DistributorReceivable" ADD CONSTRAINT "DistributorReceivable_outboundInvoiceId_fkey" FOREIGN KEY ("outboundInvoiceId") REFERENCES "DistributorOutboundInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DistributorReceivable" ADD CONSTRAINT "DistributorReceivable_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "DistributorLedgerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
