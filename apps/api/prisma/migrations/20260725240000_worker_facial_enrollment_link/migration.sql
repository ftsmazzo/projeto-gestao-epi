-- CreateTable
CREATE TABLE "WorkerFacialEnrollmentLink" (
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkerFacialEnrollmentLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkerFacialEnrollmentLink_tokenHash_key" ON "WorkerFacialEnrollmentLink"("tokenHash");
CREATE INDEX "WorkerFacialEnrollmentLink_organizationId_idx" ON "WorkerFacialEnrollmentLink"("organizationId");
CREATE INDEX "WorkerFacialEnrollmentLink_servedClientId_idx" ON "WorkerFacialEnrollmentLink"("servedClientId");
CREATE INDEX "WorkerFacialEnrollmentLink_workerId_idx" ON "WorkerFacialEnrollmentLink"("workerId");
CREATE INDEX "WorkerFacialEnrollmentLink_expiresAt_idx" ON "WorkerFacialEnrollmentLink"("expiresAt");
CREATE INDEX "WorkerFacialEnrollmentLink_consumedAt_idx" ON "WorkerFacialEnrollmentLink"("consumedAt");

-- AddForeignKey
ALTER TABLE "WorkerFacialEnrollmentLink" ADD CONSTRAINT "WorkerFacialEnrollmentLink_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkerFacialEnrollmentLink" ADD CONSTRAINT "WorkerFacialEnrollmentLink_servedClientId_fkey" FOREIGN KEY ("servedClientId") REFERENCES "ServedClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkerFacialEnrollmentLink" ADD CONSTRAINT "WorkerFacialEnrollmentLink_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkerFacialEnrollmentLink" ADD CONSTRAINT "WorkerFacialEnrollmentLink_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
