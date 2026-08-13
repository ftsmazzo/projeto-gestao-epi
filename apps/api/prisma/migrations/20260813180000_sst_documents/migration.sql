-- CreateEnum
CREATE TYPE "SstDocumentType" AS ENUM ('INTEGRACAO', 'ORDEM_SERVICO');

-- CreateEnum
CREATE TYPE "SstDocumentStatus" AS ENUM ('PENDING_SIGNATURE', 'SIGNED', 'CANCELLED');

-- CreateTable
CREATE TABLE "SstClientProfile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "servedClientId" TEXT NOT NULL,
    "technicalResponsibleName" TEXT,
    "technicalResponsibleRegistry" TEXT,
    "city" TEXT,
    "integrationDurationHours" INTEGER NOT NULL DEFAULT 2,
    "integrationTime" TEXT NOT NULL DEFAULT '08:00',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SstClientProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SstDocument" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "servedClientId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "type" "SstDocumentType" NOT NULL,
    "status" "SstDocumentStatus" NOT NULL DEFAULT 'PENDING_SIGNATURE',
    "title" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "signedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SstDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SstDocumentLink" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "servedClientId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SstDocumentLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SstDocumentEvidence" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "matchDistance" DOUBLE PRECISION,
    "matchThreshold" DOUBLE PRECISION,
    "faceEngine" TEXT,
    "livenessPassed" BOOLEAN,
    "livenessChallenge" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SstDocumentEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SstClientProfile_servedClientId_key" ON "SstClientProfile"("servedClientId");
CREATE INDEX "SstClientProfile_organizationId_idx" ON "SstClientProfile"("organizationId");
CREATE INDEX "SstDocument_organizationId_servedClientId_idx" ON "SstDocument"("organizationId", "servedClientId");
CREATE INDEX "SstDocument_workerId_idx" ON "SstDocument"("workerId");
CREATE INDEX "SstDocument_status_idx" ON "SstDocument"("status");
CREATE INDEX "SstDocument_createdAt_idx" ON "SstDocument"("createdAt");
CREATE UNIQUE INDEX "SstDocumentLink_tokenHash_key" ON "SstDocumentLink"("tokenHash");
CREATE INDEX "SstDocumentLink_documentId_idx" ON "SstDocumentLink"("documentId");
CREATE INDEX "SstDocumentLink_workerId_idx" ON "SstDocumentLink"("workerId");
CREATE INDEX "SstDocumentLink_expiresAt_idx" ON "SstDocumentLink"("expiresAt");
CREATE UNIQUE INDEX "SstDocumentEvidence_documentId_key" ON "SstDocumentEvidence"("documentId");

-- AddForeignKey
ALTER TABLE "SstClientProfile" ADD CONSTRAINT "SstClientProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SstClientProfile" ADD CONSTRAINT "SstClientProfile_servedClientId_fkey" FOREIGN KEY ("servedClientId") REFERENCES "ServedClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SstDocument" ADD CONSTRAINT "SstDocument_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SstDocument" ADD CONSTRAINT "SstDocument_servedClientId_fkey" FOREIGN KEY ("servedClientId") REFERENCES "ServedClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SstDocument" ADD CONSTRAINT "SstDocument_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SstDocumentLink" ADD CONSTRAINT "SstDocumentLink_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SstDocumentLink" ADD CONSTRAINT "SstDocumentLink_servedClientId_fkey" FOREIGN KEY ("servedClientId") REFERENCES "ServedClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SstDocumentLink" ADD CONSTRAINT "SstDocumentLink_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SstDocumentLink" ADD CONSTRAINT "SstDocumentLink_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "SstDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SstDocumentEvidence" ADD CONSTRAINT "SstDocumentEvidence_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "SstDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
