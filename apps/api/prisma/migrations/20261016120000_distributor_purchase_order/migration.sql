-- AlterEnum
ALTER TYPE "DistributorMovementSource" ADD VALUE 'PURCHASE_ORDER';

-- CreateEnum
CREATE TYPE "DistributorPurchaseOrderStatus" AS ENUM ('AWAITING_FIRST', 'AWAITING_SECOND', 'APPROVED', 'REJECTED', 'RECEIVED');

-- AlterTable
ALTER TABLE "DistributorMovement" ADD COLUMN "purchaseOrderId" TEXT;

-- CreateTable
CREATE TABLE "DistributorPurchaseOrder" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "supplierName" TEXT NOT NULL,
    "status" "DistributorPurchaseOrderStatus" NOT NULL DEFAULT 'AWAITING_FIRST',
    "createdByUserId" TEXT NOT NULL,
    "firstApprovedByUserId" TEXT,
    "firstApprovedAt" TIMESTAMP(3),
    "secondApprovedByUserId" TEXT,
    "secondApprovedAt" TIMESTAMP(3),
    "rejectedByUserId" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionNote" TEXT,
    "receivedByUserId" TEXT,
    "receivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DistributorPurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DistributorPurchaseLine" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitCostCents" INTEGER,

    CONSTRAINT "DistributorPurchaseLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DistributorMovement_purchaseOrderId_idx" ON "DistributorMovement"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "DistributorPurchaseOrder_organizationId_status_idx" ON "DistributorPurchaseOrder"("organizationId", "status");

-- CreateIndex
CREATE INDEX "DistributorPurchaseLine_orderId_idx" ON "DistributorPurchaseLine"("orderId");

-- CreateIndex
CREATE INDEX "DistributorPurchaseLine_variantId_idx" ON "DistributorPurchaseLine"("variantId");

-- AddForeignKey
ALTER TABLE "DistributorMovement" ADD CONSTRAINT "DistributorMovement_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "DistributorPurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistributorPurchaseOrder" ADD CONSTRAINT "DistributorPurchaseOrder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistributorPurchaseLine" ADD CONSTRAINT "DistributorPurchaseLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "DistributorPurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistributorPurchaseLine" ADD CONSTRAINT "DistributorPurchaseLine_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "DistributorVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
