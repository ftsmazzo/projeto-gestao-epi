-- CreateEnum
CREATE TYPE "DistributorPlusStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateTable
CREATE TABLE "DistributorPlusContract" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "consultoriaOrganizationId" TEXT NOT NULL,
    "servedClientId" TEXT NOT NULL,
    "status" "DistributorPlusStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdByUserId" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DistributorPlusContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DistributorPlusMapping" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "epiItemId" TEXT NOT NULL,
    "epiVariantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DistributorPlusMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DistributorPlusShipment" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "outboundInvoiceId" TEXT NOT NULL,
    "stockLocationId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DistributorPlusShipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DistributorPlusShipmentLine" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "epiItemId" TEXT NOT NULL,
    "epiVariantId" TEXT,
    "quantity" INTEGER NOT NULL,
    "epiStockMovementId" TEXT,

    CONSTRAINT "DistributorPlusShipmentLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DistributorPlusContract_organizationId_servedClientId_key" ON "DistributorPlusContract"("organizationId", "servedClientId");
CREATE INDEX "DistributorPlusContract_organizationId_status_idx" ON "DistributorPlusContract"("organizationId", "status");
CREATE INDEX "DistributorPlusContract_consultoriaOrganizationId_idx" ON "DistributorPlusContract"("consultoriaOrganizationId");
CREATE INDEX "DistributorPlusContract_servedClientId_idx" ON "DistributorPlusContract"("servedClientId");

CREATE UNIQUE INDEX "DistributorPlusMapping_contractId_variantId_key" ON "DistributorPlusMapping"("contractId", "variantId");
CREATE INDEX "DistributorPlusMapping_variantId_idx" ON "DistributorPlusMapping"("variantId");
CREATE INDEX "DistributorPlusMapping_epiItemId_idx" ON "DistributorPlusMapping"("epiItemId");

CREATE UNIQUE INDEX "DistributorPlusShipment_outboundInvoiceId_key" ON "DistributorPlusShipment"("outboundInvoiceId");
CREATE INDEX "DistributorPlusShipment_contractId_createdAt_idx" ON "DistributorPlusShipment"("contractId", "createdAt");

CREATE INDEX "DistributorPlusShipmentLine_shipmentId_idx" ON "DistributorPlusShipmentLine"("shipmentId");
CREATE INDEX "DistributorPlusShipmentLine_variantId_idx" ON "DistributorPlusShipmentLine"("variantId");
CREATE INDEX "DistributorPlusShipmentLine_epiStockMovementId_idx" ON "DistributorPlusShipmentLine"("epiStockMovementId");

-- AddForeignKey
ALTER TABLE "DistributorPlusContract" ADD CONSTRAINT "DistributorPlusContract_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DistributorPlusContract" ADD CONSTRAINT "DistributorPlusContract_consultoriaOrganizationId_fkey" FOREIGN KEY ("consultoriaOrganizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DistributorPlusContract" ADD CONSTRAINT "DistributorPlusContract_servedClientId_fkey" FOREIGN KEY ("servedClientId") REFERENCES "ServedClient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DistributorPlusMapping" ADD CONSTRAINT "DistributorPlusMapping_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "DistributorPlusContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DistributorPlusMapping" ADD CONSTRAINT "DistributorPlusMapping_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "DistributorVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DistributorPlusShipment" ADD CONSTRAINT "DistributorPlusShipment_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "DistributorPlusContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DistributorPlusShipment" ADD CONSTRAINT "DistributorPlusShipment_outboundInvoiceId_fkey" FOREIGN KEY ("outboundInvoiceId") REFERENCES "DistributorOutboundInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DistributorPlusShipmentLine" ADD CONSTRAINT "DistributorPlusShipmentLine_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "DistributorPlusShipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DistributorPlusShipmentLine" ADD CONSTRAINT "DistributorPlusShipmentLine_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "DistributorVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
