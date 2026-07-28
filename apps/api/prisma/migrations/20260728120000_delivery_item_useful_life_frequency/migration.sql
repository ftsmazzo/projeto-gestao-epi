-- Snapshot de vida util / frequencia de uso na entrega (proxima troca).
ALTER TABLE "EpiDeliveryItem"
  ADD COLUMN IF NOT EXISTS "usefulLifeValue" INTEGER,
  ADD COLUMN IF NOT EXISTS "usefulLifeUnit" "EpiUsefulLifeUnit",
  ADD COLUMN IF NOT EXISTS "usageDaysPerWeek" INTEGER;
