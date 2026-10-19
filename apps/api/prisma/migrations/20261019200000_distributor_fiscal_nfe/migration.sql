-- CreateEnum
CREATE TYPE "DistributorTaxRegime" AS ENUM ('PRESUMIDO', 'SIMPLES', 'REAL');

-- AlterTable
ALTER TABLE "DistributorInboundDocument" ADD COLUMN "supplierCnpj" TEXT;
ALTER TABLE "DistributorInboundDocument" ADD COLUMN "accessKey" TEXT;
ALTER TABLE "DistributorInboundLine" ADD COLUMN "ncm" TEXT;
ALTER TABLE "DistributorInboundLine" ADD COLUMN "cfop" TEXT;

-- CreateTable
CREATE TABLE "DistributorFiscalProfile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "stateRegistration" TEXT,
    "uf" TEXT NOT NULL,
    "regime" "DistributorTaxRegime" NOT NULL DEFAULT 'PRESUMIDO',
    "certificateCipher" BYTEA,
    "certificateIv" BYTEA,
    "certificateTag" BYTEA,
    "certificateUpdatedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DistributorFiscalProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DistributorDfeCursor" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "lastNsu" TEXT NOT NULL DEFAULT '0',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DistributorDfeCursor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DistributorInboundDocument_organizationId_accessKey_key" ON "DistributorInboundDocument"("organizationId", "accessKey");
CREATE UNIQUE INDEX "DistributorFiscalProfile_organizationId_key" ON "DistributorFiscalProfile"("organizationId");
CREATE UNIQUE INDEX "DistributorDfeCursor_organizationId_key" ON "DistributorDfeCursor"("organizationId");

-- AddForeignKey
ALTER TABLE "DistributorFiscalProfile" ADD CONSTRAINT "DistributorFiscalProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DistributorDfeCursor" ADD CONSTRAINT "DistributorDfeCursor_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
