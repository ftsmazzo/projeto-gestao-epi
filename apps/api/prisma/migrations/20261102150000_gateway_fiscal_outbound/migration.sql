-- AlterTable
ALTER TABLE "DistributorOutboundInvoice" ADD COLUMN "gatewayDocumentId" TEXT;
ALTER TABLE "DistributorOutboundInvoice" ADD COLUMN "gatewayStatus" TEXT;
ALTER TABLE "DistributorOutboundInvoice" ADD COLUMN "gatewayRejection" TEXT;

-- CreateIndex
CREATE INDEX "DistributorOutboundInvoice_gatewayDocumentId_idx" ON "DistributorOutboundInvoice"("gatewayDocumentId");
