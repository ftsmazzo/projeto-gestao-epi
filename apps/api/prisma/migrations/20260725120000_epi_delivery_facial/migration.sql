-- AlterEnum
ALTER TYPE "EpiStockMovementType" ADD VALUE 'ENTREGA';

-- CreateEnum
CREATE TYPE "EpiDeliveryStatus" AS ENUM ('COMPLETED', 'CANCELLED');
CREATE TYPE "DeliveryEvidenceType" AS ENUM ('FACIAL_CAPTURE');
CREATE TYPE "DeliveryEvidenceVerificationStatus" AS ENUM ('CAPTURED', 'NOT_VERIFIED');

-- CreateTable
CREATE TABLE "EpiDelivery" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "servedClientId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "deliveredByUserId" TEXT NOT NULL,
    "status" "EpiDeliveryStatus" NOT NULL DEFAULT 'COMPLETED',
    "deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EpiDelivery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EpiDeliveryItem" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "epiNeedId" TEXT NOT NULL,
    "epiItemId" TEXT NOT NULL,
    "epiVariantId" TEXT,
    "stockLocationId" TEXT NOT NULL,
    "stockMovementId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "nextReplacementAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EpiDeliveryItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeliveryEvidence" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "type" "DeliveryEvidenceType" NOT NULL DEFAULT 'FACIAL_CAPTURE',
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "filePath" TEXT NOT NULL,
    "fileHash" TEXT,
    "mimeType" TEXT,
    "byteSize" INTEGER,
    "verificationStatus" "DeliveryEvidenceVerificationStatus" NOT NULL DEFAULT 'CAPTURED',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryEvidence_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "EpiDelivery_organizationId_idx" ON "EpiDelivery"("organizationId");
CREATE INDEX "EpiDelivery_servedClientId_idx" ON "EpiDelivery"("servedClientId");
CREATE INDEX "EpiDelivery_workerId_idx" ON "EpiDelivery"("workerId");
CREATE INDEX "EpiDelivery_deliveredByUserId_idx" ON "EpiDelivery"("deliveredByUserId");
CREATE INDEX "EpiDelivery_deliveredAt_idx" ON "EpiDelivery"("deliveredAt");
CREATE INDEX "EpiDelivery_status_idx" ON "EpiDelivery"("status");

CREATE INDEX "EpiDeliveryItem_deliveryId_idx" ON "EpiDeliveryItem"("deliveryId");
CREATE INDEX "EpiDeliveryItem_epiNeedId_idx" ON "EpiDeliveryItem"("epiNeedId");
CREATE INDEX "EpiDeliveryItem_epiItemId_idx" ON "EpiDeliveryItem"("epiItemId");
CREATE INDEX "EpiDeliveryItem_stockLocationId_idx" ON "EpiDeliveryItem"("stockLocationId");
CREATE INDEX "EpiDeliveryItem_stockMovementId_idx" ON "EpiDeliveryItem"("stockMovementId");

CREATE INDEX "DeliveryEvidence_deliveryId_idx" ON "DeliveryEvidence"("deliveryId");
CREATE INDEX "DeliveryEvidence_type_idx" ON "DeliveryEvidence"("type");
CREATE INDEX "DeliveryEvidence_capturedAt_idx" ON "DeliveryEvidence"("capturedAt");

-- FKs
ALTER TABLE "EpiDelivery" ADD CONSTRAINT "EpiDelivery_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EpiDelivery" ADD CONSTRAINT "EpiDelivery_servedClientId_fkey" FOREIGN KEY ("servedClientId") REFERENCES "ServedClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EpiDelivery" ADD CONSTRAINT "EpiDelivery_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EpiDelivery" ADD CONSTRAINT "EpiDelivery_deliveredByUserId_fkey" FOREIGN KEY ("deliveredByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EpiDeliveryItem" ADD CONSTRAINT "EpiDeliveryItem_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "EpiDelivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EpiDeliveryItem" ADD CONSTRAINT "EpiDeliveryItem_epiNeedId_fkey" FOREIGN KEY ("epiNeedId") REFERENCES "EpiNeed"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EpiDeliveryItem" ADD CONSTRAINT "EpiDeliveryItem_epiItemId_fkey" FOREIGN KEY ("epiItemId") REFERENCES "EpiItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EpiDeliveryItem" ADD CONSTRAINT "EpiDeliveryItem_epiVariantId_fkey" FOREIGN KEY ("epiVariantId") REFERENCES "EpiVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EpiDeliveryItem" ADD CONSTRAINT "EpiDeliveryItem_stockLocationId_fkey" FOREIGN KEY ("stockLocationId") REFERENCES "StockLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EpiDeliveryItem" ADD CONSTRAINT "EpiDeliveryItem_stockMovementId_fkey" FOREIGN KEY ("stockMovementId") REFERENCES "EpiStockMovement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DeliveryEvidence" ADD CONSTRAINT "DeliveryEvidence_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "EpiDelivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
