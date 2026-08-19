-- CreateEnum
CREATE TYPE "TrainingDeliveryKind" AS ENUM ('INTERNO', 'TLT', 'EXTERNO');

-- CreateEnum
CREATE TYPE "TrainingAssetKind" AS ENUM ('HEADER', 'LEFT_LOGO', 'RIGHT_LOGO', 'SEAL');

-- CreateTable
CREATE TABLE "TrainingTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "courseTitle" TEXT NOT NULL,
    "nrLabel" TEXT NOT NULL DEFAULT '',
    "defaultHours" INTEGER NOT NULL DEFAULT 8,
    "defaultLocation" TEXT NOT NULL DEFAULT 'Sala de Treinamento',
    "certificateCourseClause" TEXT NOT NULL,
    "topics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "registerSummary" TEXT NOT NULL DEFAULT '',
    "instructorName" TEXT NOT NULL DEFAULT '',
    "instructorRole" TEXT NOT NULL DEFAULT 'Tecnico em Seguranca do Trabalho',
    "instructorRegistry" TEXT NOT NULL DEFAULT '',
    "includeCertificate" BOOLEAN NOT NULL DEFAULT true,
    "includeRegister" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingTemplateAsset" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "kind" "TrainingAssetKind" NOT NULL,
    "relativePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingTemplateAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingIssuance" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "servedClientId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "heldOn" TIMESTAMP(3) NOT NULL,
    "hours" INTEGER NOT NULL,
    "location" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "instructorName" TEXT NOT NULL,
    "instructorRole" TEXT NOT NULL,
    "instructorRegistry" TEXT NOT NULL,
    "legalRepName" TEXT NOT NULL,
    "deliveryKind" "TrainingDeliveryKind" NOT NULL DEFAULT 'INTERNO',
    "controlNumber" TEXT,
    "workerIds" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingIssuance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrainingTemplate_organizationId_idx" ON "TrainingTemplate"("organizationId");

-- CreateIndex
CREATE INDEX "TrainingTemplate_organizationId_isActive_idx" ON "TrainingTemplate"("organizationId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingTemplateAsset_templateId_kind_key" ON "TrainingTemplateAsset"("templateId", "kind");

-- CreateIndex
CREATE INDEX "TrainingTemplateAsset_organizationId_idx" ON "TrainingTemplateAsset"("organizationId");

-- CreateIndex
CREATE INDEX "TrainingIssuance_organizationId_idx" ON "TrainingIssuance"("organizationId");

-- CreateIndex
CREATE INDEX "TrainingIssuance_servedClientId_idx" ON "TrainingIssuance"("servedClientId");

-- CreateIndex
CREATE INDEX "TrainingIssuance_createdAt_idx" ON "TrainingIssuance"("createdAt");

-- AddForeignKey
ALTER TABLE "TrainingTemplate" ADD CONSTRAINT "TrainingTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingTemplateAsset" ADD CONSTRAINT "TrainingTemplateAsset_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingTemplateAsset" ADD CONSTRAINT "TrainingTemplateAsset_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "TrainingTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingIssuance" ADD CONSTRAINT "TrainingIssuance_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingIssuance" ADD CONSTRAINT "TrainingIssuance_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "TrainingTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingIssuance" ADD CONSTRAINT "TrainingIssuance_servedClientId_fkey" FOREIGN KEY ("servedClientId") REFERENCES "ServedClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
