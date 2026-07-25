-- AlterTable
ALTER TABLE "EpiDelivery" ADD COLUMN "receiptNumber" TEXT;
ALTER TABLE "EpiDelivery" ADD COLUMN "evidenceConsentText" TEXT;
ALTER TABLE "EpiDelivery" ADD COLUMN "evidenceConsentVersion" TEXT;
ALTER TABLE "EpiDelivery" ADD COLUMN "evidenceConsentAcceptedAt" TIMESTAMP(3);
ALTER TABLE "EpiDelivery" ADD COLUMN "operatorIp" TEXT;
ALTER TABLE "EpiDelivery" ADD COLUMN "userAgent" TEXT;

-- Backfill receiptNumber for any existing rows (idempotent if none)
UPDATE "EpiDelivery"
SET "receiptNumber" = 'ENT-' || UPPER(SUBSTRING(id FROM 1 FOR 8))
WHERE "receiptNumber" IS NULL;

ALTER TABLE "EpiDelivery" ALTER COLUMN "receiptNumber" SET NOT NULL;

CREATE UNIQUE INDEX "EpiDelivery_servedClientId_receiptNumber_key" ON "EpiDelivery"("servedClientId", "receiptNumber");
CREATE INDEX "EpiDelivery_receiptNumber_idx" ON "EpiDelivery"("receiptNumber");
