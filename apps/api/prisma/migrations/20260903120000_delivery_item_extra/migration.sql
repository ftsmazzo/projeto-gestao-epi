-- AlterTable
ALTER TABLE "EpiDeliveryItem" ADD COLUMN "isExtra" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "EpiDeliveryItem" ALTER COLUMN "epiNeedId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "EpiDeliveryItem_isExtra_idx" ON "EpiDeliveryItem"("isExtra");
