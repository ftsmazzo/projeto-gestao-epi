-- CreateEnum
CREATE TYPE "WorkerBiometricConsentStatus" AS ENUM ('GRANTED', 'REVOKED');

-- CreateEnum
CREATE TYPE "WorkerBiometricDeletionStatus" AS ENUM ('NONE', 'PENDING', 'DELETED');

-- AlterTable EpiDelivery: snapshot do consentimento biométrico no ato
ALTER TABLE "EpiDelivery" ADD COLUMN "biometricConsentStatus" "WorkerBiometricConsentStatus",
ADD COLUMN "biometricConsentVersion" TEXT,
ADD COLUMN "biometricConsentGrantedAt" TIMESTAMP(3);

-- AlterTable WorkerFacialReference: base de retenção/exclusão futura
ALTER TABLE "WorkerFacialReference" ADD COLUMN "retentionUntil" TIMESTAMP(3),
ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "deletionStatus" "WorkerBiometricDeletionStatus" NOT NULL DEFAULT 'NONE';

-- CreateTable
CREATE TABLE "WorkerBiometricConsent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "servedClientId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "status" "WorkerBiometricConsentStatus" NOT NULL DEFAULT 'GRANTED',
    "consentText" TEXT NOT NULL,
    "consentVersion" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revocationReason" TEXT,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "retentionUntil" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "deletionStatus" "WorkerBiometricDeletionStatus" NOT NULL DEFAULT 'NONE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkerBiometricConsent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkerBiometricConsent_organizationId_idx" ON "WorkerBiometricConsent"("organizationId");
CREATE INDEX "WorkerBiometricConsent_servedClientId_idx" ON "WorkerBiometricConsent"("servedClientId");
CREATE INDEX "WorkerBiometricConsent_workerId_idx" ON "WorkerBiometricConsent"("workerId");
CREATE INDEX "WorkerBiometricConsent_status_idx" ON "WorkerBiometricConsent"("status");
CREATE INDEX "WorkerBiometricConsent_grantedAt_idx" ON "WorkerBiometricConsent"("grantedAt");
CREATE INDEX "WorkerBiometricConsent_retentionUntil_idx" ON "WorkerBiometricConsent"("retentionUntil");
CREATE INDEX "WorkerBiometricConsent_deletionStatus_idx" ON "WorkerBiometricConsent"("deletionStatus");

CREATE INDEX "WorkerFacialReference_retentionUntil_idx" ON "WorkerFacialReference"("retentionUntil");
CREATE INDEX "WorkerFacialReference_deletionStatus_idx" ON "WorkerFacialReference"("deletionStatus");

-- AddForeignKey
ALTER TABLE "WorkerBiometricConsent" ADD CONSTRAINT "WorkerBiometricConsent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkerBiometricConsent" ADD CONSTRAINT "WorkerBiometricConsent_servedClientId_fkey" FOREIGN KEY ("servedClientId") REFERENCES "ServedClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkerBiometricConsent" ADD CONSTRAINT "WorkerBiometricConsent_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkerBiometricConsent" ADD CONSTRAINT "WorkerBiometricConsent_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkerBiometricConsent" ADD CONSTRAINT "WorkerBiometricConsent_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
