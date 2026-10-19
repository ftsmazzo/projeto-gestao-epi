-- AlterEnum
ALTER TYPE "DistributorMovementSource" ADD VALUE 'OUTBOUND';
ALTER TYPE "DistributorOutboundStatus" ADD VALUE 'CONFIRMED';

-- CreateEnum
CREATE TYPE "DistributorPayableStatus" AS ENUM ('OPEN', 'PAID', 'CANCELLED');

-- AlterTable
ALTER TABLE "DistributorMovement" ADD COLUMN "outboundInvoiceId" TEXT;
ALTER TABLE "DistributorOutboundInvoice" ADD COLUMN "confirmedAt" TIMESTAMP(3);
ALTER TABLE "DistributorOutboundInvoice" ADD COLUMN "confirmedByUserId" TEXT;

-- CreateTable
CREATE TABLE "DistributorPayable" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" "DistributorPayableStatus" NOT NULL DEFAULT 'OPEN',
    "description" TEXT NOT NULL,
    "supplierName" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "dueOn" TIMESTAMP(3),
    "purchaseOrderId" TEXT,
    "inboundDocumentId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3),
    "paidByUserId" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DistributorPayable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DistributorPayable_purchaseOrderId_key" ON "DistributorPayable"("purchaseOrderId");
CREATE UNIQUE INDEX "DistributorPayable_inboundDocumentId_key" ON "DistributorPayable"("inboundDocumentId");
CREATE INDEX "DistributorPayable_organizationId_status_dueOn_idx" ON "DistributorPayable"("organizationId", "status", "dueOn");
CREATE INDEX "DistributorMovement_outboundInvoiceId_idx" ON "DistributorMovement"("outboundInvoiceId");

-- AddForeignKey
ALTER TABLE "DistributorMovement" ADD CONSTRAINT "DistributorMovement_outboundInvoiceId_fkey" FOREIGN KEY ("outboundInvoiceId") REFERENCES "DistributorOutboundInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DistributorPayable" ADD CONSTRAINT "DistributorPayable_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DistributorPayable" ADD CONSTRAINT "DistributorPayable_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "DistributorPurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DistributorPayable" ADD CONSTRAINT "DistributorPayable_inboundDocumentId_fkey" FOREIGN KEY ("inboundDocumentId") REFERENCES "DistributorInboundDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
