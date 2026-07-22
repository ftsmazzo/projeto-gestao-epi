-- CreateIndex
CREATE INDEX IF NOT EXISTS "CaCertificate_equipmentName_idx" ON "CaCertificate"("equipmentName");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CaCertificate_manufacturerName_idx" ON "CaCertificate"("manufacturerName");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CaCertificate_reference_idx" ON "CaCertificate"("reference");
