-- CreateEnum
CREATE TYPE "OrganizationKind" AS ENUM ('CONSULTORIA', 'DISTRIBUIDORA');
CREATE TYPE "DistributorMovementDirection" AS ENUM ('IN', 'OUT');
CREATE TYPE "DistributorMovementSource" AS ENUM ('MANUAL', 'INVOICE');
CREATE TYPE "DistributorInboundStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'DISCARDED');

-- AlterTable
ALTER TABLE "Organization"
ADD COLUMN "kind" "OrganizationKind" NOT NULL DEFAULT 'CONSULTORIA';

-- CreateTable
CREATE TABLE "DistributorProduct" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "supplierSku" TEXT,
    "internalSku" TEXT NOT NULL,
    "ncm" TEXT,
    "minQuantity" INTEGER,
    "caNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DistributorProduct_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DistributorVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DistributorVariant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DistributorBalance" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DistributorBalance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DistributorInboundDocument" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" "DistributorInboundStatus" NOT NULL DEFAULT 'DRAFT',
    "supplierName" TEXT,
    "invoiceNumber" TEXT,
    "filePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "extraction" JSONB NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DistributorInboundDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DistributorInboundLine" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitCostCents" INTEGER,
    "caNumber" TEXT,
    "variantId" TEXT,

    CONSTRAINT "DistributorInboundLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DistributorMovement" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "direction" "DistributorMovementDirection" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "source" "DistributorMovementSource" NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "documentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DistributorMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DistributorProduct_organizationId_internalSku_key" ON "DistributorProduct"("organizationId", "internalSku");
CREATE INDEX "DistributorProduct_organizationId_idx" ON "DistributorProduct"("organizationId");
CREATE UNIQUE INDEX "DistributorVariant_productId_label_key" ON "DistributorVariant"("productId", "label");
CREATE INDEX "DistributorVariant_productId_idx" ON "DistributorVariant"("productId");
CREATE UNIQUE INDEX "DistributorBalance_variantId_key" ON "DistributorBalance"("variantId");
CREATE INDEX "DistributorInboundDocument_organizationId_status_idx" ON "DistributorInboundDocument"("organizationId", "status");
CREATE INDEX "DistributorInboundLine_documentId_idx" ON "DistributorInboundLine"("documentId");
CREATE INDEX "DistributorInboundLine_variantId_idx" ON "DistributorInboundLine"("variantId");
CREATE INDEX "DistributorMovement_variantId_createdAt_idx" ON "DistributorMovement"("variantId", "createdAt");
CREATE INDEX "DistributorMovement_documentId_idx" ON "DistributorMovement"("documentId");

-- AddForeignKey
ALTER TABLE "DistributorProduct" ADD CONSTRAINT "DistributorProduct_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DistributorVariant" ADD CONSTRAINT "DistributorVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "DistributorProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DistributorBalance" ADD CONSTRAINT "DistributorBalance_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "DistributorVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DistributorInboundDocument" ADD CONSTRAINT "DistributorInboundDocument_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DistributorInboundLine" ADD CONSTRAINT "DistributorInboundLine_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "DistributorInboundDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DistributorInboundLine" ADD CONSTRAINT "DistributorInboundLine_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "DistributorVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DistributorMovement" ADD CONSTRAINT "DistributorMovement_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "DistributorVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DistributorMovement" ADD CONSTRAINT "DistributorMovement_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "DistributorInboundDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
