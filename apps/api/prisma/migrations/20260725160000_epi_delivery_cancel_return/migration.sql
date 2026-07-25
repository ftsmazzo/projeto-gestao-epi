-- AlterEnum
ALTER TYPE "EpiStockMovementType" ADD VALUE 'DEVOLUCAO';
ALTER TYPE "EpiStockMovementType" ADD VALUE 'CANCELAMENTO_ENTREGA';

-- CreateEnum
CREATE TYPE "EpiDeliveryItemStatus" AS ENUM ('DELIVERED', 'CANCELLED', 'RETURNED', 'PARTIALLY_RETURNED');
CREATE TYPE "EpiDeliveryReturnCondition" AS ENUM ('REUSABLE', 'DAMAGED', 'DISCARDED', 'LOST');

-- AlterEnum EpiDeliveryStatus (add values)
ALTER TYPE "EpiDeliveryStatus" ADD VALUE 'PARTIALLY_RETURNED';
ALTER TYPE "EpiDeliveryStatus" ADD VALUE 'RETURNED';

-- AlterTable EpiDelivery
ALTER TABLE "EpiDelivery" ADD COLUMN "cancelledAt" TIMESTAMP(3);
ALTER TABLE "EpiDelivery" ADD COLUMN "cancelledByUserId" TEXT;
ALTER TABLE "EpiDelivery" ADD COLUMN "cancelReason" TEXT;

CREATE INDEX "EpiDelivery_cancelledByUserId_idx" ON "EpiDelivery"("cancelledByUserId");
ALTER TABLE "EpiDelivery" ADD CONSTRAINT "EpiDelivery_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable EpiDeliveryItem
ALTER TABLE "EpiDeliveryItem" ADD COLUMN "returnedQuantity" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "EpiDeliveryItem" ADD COLUMN "cancelledQuantity" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "EpiDeliveryItem" ADD COLUMN "status" "EpiDeliveryItemStatus" NOT NULL DEFAULT 'DELIVERED';
CREATE INDEX "EpiDeliveryItem_status_idx" ON "EpiDeliveryItem"("status");

-- CreateTable EpiDeliveryReturn
CREATE TABLE "EpiDeliveryReturn" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "servedClientId" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "returnedByUserId" TEXT NOT NULL,
    "returnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EpiDeliveryReturn_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EpiDeliveryReturnItem" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "deliveryItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "condition" "EpiDeliveryReturnCondition" NOT NULL,
    "stockMovementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EpiDeliveryReturnItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EpiDeliveryReturn_organizationId_idx" ON "EpiDeliveryReturn"("organizationId");
CREATE INDEX "EpiDeliveryReturn_servedClientId_idx" ON "EpiDeliveryReturn"("servedClientId");
CREATE INDEX "EpiDeliveryReturn_deliveryId_idx" ON "EpiDeliveryReturn"("deliveryId");
CREATE INDEX "EpiDeliveryReturn_returnedByUserId_idx" ON "EpiDeliveryReturn"("returnedByUserId");
CREATE INDEX "EpiDeliveryReturn_returnedAt_idx" ON "EpiDeliveryReturn"("returnedAt");

CREATE INDEX "EpiDeliveryReturnItem_returnId_idx" ON "EpiDeliveryReturnItem"("returnId");
CREATE INDEX "EpiDeliveryReturnItem_deliveryItemId_idx" ON "EpiDeliveryReturnItem"("deliveryItemId");
CREATE INDEX "EpiDeliveryReturnItem_stockMovementId_idx" ON "EpiDeliveryReturnItem"("stockMovementId");
CREATE INDEX "EpiDeliveryReturnItem_condition_idx" ON "EpiDeliveryReturnItem"("condition");

ALTER TABLE "EpiDeliveryReturn" ADD CONSTRAINT "EpiDeliveryReturn_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EpiDeliveryReturn" ADD CONSTRAINT "EpiDeliveryReturn_servedClientId_fkey" FOREIGN KEY ("servedClientId") REFERENCES "ServedClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EpiDeliveryReturn" ADD CONSTRAINT "EpiDeliveryReturn_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "EpiDelivery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EpiDeliveryReturn" ADD CONSTRAINT "EpiDeliveryReturn_returnedByUserId_fkey" FOREIGN KEY ("returnedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EpiDeliveryReturnItem" ADD CONSTRAINT "EpiDeliveryReturnItem_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "EpiDeliveryReturn"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EpiDeliveryReturnItem" ADD CONSTRAINT "EpiDeliveryReturnItem_deliveryItemId_fkey" FOREIGN KEY ("deliveryItemId") REFERENCES "EpiDeliveryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EpiDeliveryReturnItem" ADD CONSTRAINT "EpiDeliveryReturnItem_stockMovementId_fkey" FOREIGN KEY ("stockMovementId") REFERENCES "EpiStockMovement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
