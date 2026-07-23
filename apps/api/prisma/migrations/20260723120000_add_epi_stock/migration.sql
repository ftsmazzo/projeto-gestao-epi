-- CreateEnum
CREATE TYPE "EpiStockMovementType" AS ENUM ('ENTRADA', 'SAIDA_MANUAL', 'AJUSTE');

-- CreateTable
CREATE TABLE "StockLocation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EpiStockBalance" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "epiItemId" TEXT NOT NULL,
    "epiVariantId" TEXT,
    "stockLocationId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "minQuantity" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EpiStockBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EpiStockMovement" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "epiItemId" TEXT NOT NULL,
    "epiVariantId" TEXT,
    "stockLocationId" TEXT NOT NULL,
    "type" "EpiStockMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "previousQuantity" INTEGER NOT NULL,
    "newQuantity" INTEGER NOT NULL,
    "reason" TEXT,
    "notes" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EpiStockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockLocation_organizationId_idx" ON "StockLocation"("organizationId");

-- CreateIndex
CREATE INDEX "StockLocation_isActive_idx" ON "StockLocation"("isActive");

-- CreateIndex
CREATE INDEX "EpiStockBalance_organizationId_idx" ON "EpiStockBalance"("organizationId");

-- CreateIndex
CREATE INDEX "EpiStockBalance_epiItemId_idx" ON "EpiStockBalance"("epiItemId");

-- CreateIndex
CREATE INDEX "EpiStockBalance_epiVariantId_idx" ON "EpiStockBalance"("epiVariantId");

-- CreateIndex
CREATE INDEX "EpiStockBalance_stockLocationId_idx" ON "EpiStockBalance"("stockLocationId");

-- Unicidade com e sem variacao (NULL tratado via COALESCE)
CREATE UNIQUE INDEX "EpiStockBalance_org_item_variant_location_uidx"
ON "EpiStockBalance" ("organizationId", "epiItemId", "stockLocationId", (COALESCE("epiVariantId", '')));

-- CreateIndex
CREATE INDEX "EpiStockMovement_organizationId_idx" ON "EpiStockMovement"("organizationId");

-- CreateIndex
CREATE INDEX "EpiStockMovement_epiItemId_idx" ON "EpiStockMovement"("epiItemId");

-- CreateIndex
CREATE INDEX "EpiStockMovement_stockLocationId_idx" ON "EpiStockMovement"("stockLocationId");

-- CreateIndex
CREATE INDEX "EpiStockMovement_type_idx" ON "EpiStockMovement"("type");

-- CreateIndex
CREATE INDEX "EpiStockMovement_createdAt_idx" ON "EpiStockMovement"("createdAt");

-- AddForeignKey
ALTER TABLE "StockLocation" ADD CONSTRAINT "StockLocation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EpiStockBalance" ADD CONSTRAINT "EpiStockBalance_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EpiStockBalance" ADD CONSTRAINT "EpiStockBalance_epiItemId_fkey" FOREIGN KEY ("epiItemId") REFERENCES "EpiItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EpiStockBalance" ADD CONSTRAINT "EpiStockBalance_epiVariantId_fkey" FOREIGN KEY ("epiVariantId") REFERENCES "EpiVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EpiStockBalance" ADD CONSTRAINT "EpiStockBalance_stockLocationId_fkey" FOREIGN KEY ("stockLocationId") REFERENCES "StockLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EpiStockMovement" ADD CONSTRAINT "EpiStockMovement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EpiStockMovement" ADD CONSTRAINT "EpiStockMovement_epiItemId_fkey" FOREIGN KEY ("epiItemId") REFERENCES "EpiItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EpiStockMovement" ADD CONSTRAINT "EpiStockMovement_epiVariantId_fkey" FOREIGN KEY ("epiVariantId") REFERENCES "EpiVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EpiStockMovement" ADD CONSTRAINT "EpiStockMovement_stockLocationId_fkey" FOREIGN KEY ("stockLocationId") REFERENCES "StockLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EpiStockMovement" ADD CONSTRAINT "EpiStockMovement_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
