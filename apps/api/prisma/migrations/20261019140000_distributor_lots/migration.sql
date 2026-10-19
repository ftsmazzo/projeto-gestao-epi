-- AlterTable
ALTER TABLE "DistributorProduct" ADD COLUMN "tracksLot" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "DistributorMovement" ADD COLUMN "lotId" TEXT;
ALTER TABLE "DistributorInboundLine" ADD COLUMN "lotCode" TEXT;
ALTER TABLE "DistributorInboundLine" ADD COLUMN "expiresOn" TIMESTAMP(3);
ALTER TABLE "DistributorPurchaseLine" ADD COLUMN "lotCode" TEXT;
ALTER TABLE "DistributorPurchaseLine" ADD COLUMN "expiresOn" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "DistributorLot" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresOn" TIMESTAMP(3),
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DistributorLot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DistributorLot_variantId_code_key" ON "DistributorLot"("variantId", "code");
CREATE INDEX "DistributorLot_variantId_expiresOn_idx" ON "DistributorLot"("variantId", "expiresOn");
CREATE INDEX "DistributorMovement_lotId_idx" ON "DistributorMovement"("lotId");

-- AddForeignKey
ALTER TABLE "DistributorLot" ADD CONSTRAINT "DistributorLot_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "DistributorVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DistributorMovement" ADD CONSTRAINT "DistributorMovement_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "DistributorLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
