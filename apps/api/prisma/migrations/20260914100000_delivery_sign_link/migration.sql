-- CreateTable
CREATE TABLE "EpiDeliverySignLink" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "servedClientId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "createdByUserId" TEXT,
    "consumedByDeliveryId" TEXT,
    "signedAt" TIMESTAMP(3),
    "consentAcceptedAt" TIMESTAMP(3),
    "consentVersion" TEXT,
    "consentText" TEXT,
    "filePath" TEXT,
    "fileHash" TEXT,
    "mimeType" TEXT,
    "byteSize" INTEGER,
    "matchDistance" DOUBLE PRECISION,
    "matchThreshold" DOUBLE PRECISION,
    "faceEngine" TEXT,
    "livenessPassed" BOOLEAN,
    "livenessChallenge" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EpiDeliverySignLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EpiDeliverySignLink_tokenHash_key" ON "EpiDeliverySignLink"("tokenHash");

-- CreateIndex
CREATE INDEX "EpiDeliverySignLink_organizationId_idx" ON "EpiDeliverySignLink"("organizationId");

-- CreateIndex
CREATE INDEX "EpiDeliverySignLink_servedClientId_idx" ON "EpiDeliverySignLink"("servedClientId");

-- CreateIndex
CREATE INDEX "EpiDeliverySignLink_workerId_idx" ON "EpiDeliverySignLink"("workerId");

-- CreateIndex
CREATE INDEX "EpiDeliverySignLink_expiresAt_idx" ON "EpiDeliverySignLink"("expiresAt");

-- CreateIndex
CREATE INDEX "EpiDeliverySignLink_consumedAt_idx" ON "EpiDeliverySignLink"("consumedAt");

-- CreateIndex
CREATE INDEX "EpiDeliverySignLink_signedAt_idx" ON "EpiDeliverySignLink"("signedAt");

-- CreateIndex
CREATE INDEX "EpiDeliverySignLink_consumedByDeliveryId_idx" ON "EpiDeliverySignLink"("consumedByDeliveryId");

-- AddForeignKey
ALTER TABLE "EpiDeliverySignLink" ADD CONSTRAINT "EpiDeliverySignLink_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EpiDeliverySignLink" ADD CONSTRAINT "EpiDeliverySignLink_servedClientId_fkey" FOREIGN KEY ("servedClientId") REFERENCES "ServedClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EpiDeliverySignLink" ADD CONSTRAINT "EpiDeliverySignLink_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EpiDeliverySignLink" ADD CONSTRAINT "EpiDeliverySignLink_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
