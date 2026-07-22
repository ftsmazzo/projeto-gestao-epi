-- CreateEnum
CREATE TYPE "CaCertificateStatus" AS ENUM ('VALIDO', 'VENCIDO', 'CANCELADO', 'SUSPENSO', 'DESCONHECIDO');

-- CreateEnum
CREATE TYPE "CaCertificateSource" AS ENUM ('CAEPI_OFICIAL');

-- CreateTable
CREATE TABLE "CaCertificate" (
    "id" TEXT NOT NULL,
    "caNumber" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "status" "CaCertificateStatus" NOT NULL DEFAULT 'DESCONHECIDO',
    "processNumber" TEXT,
    "manufacturerCnpj" TEXT,
    "manufacturerName" TEXT,
    "nature" TEXT,
    "equipmentName" TEXT,
    "equipmentDescription" TEXT,
    "brand" TEXT,
    "reference" TEXT,
    "color" TEXT,
    "approvedFor" TEXT,
    "restriction" TEXT,
    "analysisNotes" TEXT,
    "source" "CaCertificateSource" NOT NULL DEFAULT 'CAEPI_OFICIAL',
    "sourceImportedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaCertificateNorm" (
    "id" TEXT NOT NULL,
    "certificateId" TEXT NOT NULL,
    "laboratoryCnpj" TEXT,
    "laboratoryName" TEXT,
    "reportNumber" TEXT,
    "standard" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaCertificateNorm_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CaCertificate_caNumber_key" ON "CaCertificate"("caNumber");

-- CreateIndex
CREATE INDEX "CaCertificate_status_idx" ON "CaCertificate"("status");

-- CreateIndex
CREATE INDEX "CaCertificate_manufacturerCnpj_idx" ON "CaCertificate"("manufacturerCnpj");

-- CreateIndex
CREATE INDEX "CaCertificate_expiresAt_idx" ON "CaCertificate"("expiresAt");

-- CreateIndex
CREATE INDEX "CaCertificateNorm_certificateId_idx" ON "CaCertificateNorm"("certificateId");

-- CreateIndex
CREATE INDEX "CaCertificateNorm_standard_idx" ON "CaCertificateNorm"("standard");

-- CreateIndex
CREATE UNIQUE INDEX "CaCertificateNorm_certificateId_laboratoryCnpj_reportNumber_standard_key" ON "CaCertificateNorm"("certificateId", "laboratoryCnpj", "reportNumber", "standard");

-- AddForeignKey
ALTER TABLE "CaCertificateNorm" ADD CONSTRAINT "CaCertificateNorm_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "CaCertificate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
