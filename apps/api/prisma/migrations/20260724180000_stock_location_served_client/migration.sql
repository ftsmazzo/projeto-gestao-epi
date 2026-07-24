-- AlterTable
ALTER TABLE "StockLocation" ADD COLUMN "servedClientId" TEXT;

-- AddForeignKey
ALTER TABLE "StockLocation" ADD CONSTRAINT "StockLocation_servedClientId_fkey" FOREIGN KEY ("servedClientId") REFERENCES "ServedClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "StockLocation_servedClientId_idx" ON "StockLocation"("servedClientId");
