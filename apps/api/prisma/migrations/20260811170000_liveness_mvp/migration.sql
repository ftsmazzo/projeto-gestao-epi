-- Liveness MVP (desafio leve face-api; nao e provider certificado).
ALTER TABLE "DeliveryEvidence"
ADD COLUMN IF NOT EXISTS "livenessPassed" BOOLEAN,
ADD COLUMN IF NOT EXISTS "livenessChallenge" TEXT;

ALTER TABLE "WorkerFacialReference"
ADD COLUMN IF NOT EXISTS "livenessPassed" BOOLEAN,
ADD COLUMN IF NOT EXISTS "livenessChallenge" TEXT;
