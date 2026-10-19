-- CreateEnum
CREATE TYPE "DistributorOutboundStatus" AS ENUM ('DRAFT', 'CANCELLED', 'AUTHORIZED');

-- CreateTable
CREATE TABLE "DistributorOutboundInvoice" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "quoteId" TEXT,
    "status" "DistributorOutboundStatus" NOT NULL DEFAULT 'DRAFT',
    "series" TEXT NOT NULL DEFAULT '1',
    "number" INTEGER NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerCnpj" TEXT NOT NULL,
    "customerUf" TEXT NOT NULL,
    "emitterCnpj" TEXT NOT NULL,
    "emitterUf" TEXT NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "accessKey" TEXT,
    "protocol" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DistributorOutboundInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DistributorOutboundLine" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "discountBps" INTEGER NOT NULL DEFAULT 0,
    "ncm" TEXT NOT NULL,
    "cfop" TEXT NOT NULL,
    "originCode" INTEGER NOT NULL DEFAULT 0,
    "cest" TEXT,
    "icmsSt" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "DistributorOutboundLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DistributorOutboundInvoice_quoteId_key" ON "DistributorOutboundInvoice"("quoteId");
CREATE UNIQUE INDEX "DistributorOutboundInvoice_organizationId_series_number_key" ON "DistributorOutboundInvoice"("organizationId", "series", "number");
CREATE INDEX "DistributorOutboundInvoice_organizationId_status_idx" ON "DistributorOutboundInvoice"("organizationId", "status");
CREATE INDEX "DistributorOutboundLine_invoiceId_idx" ON "DistributorOutboundLine"("invoiceId");
CREATE INDEX "DistributorOutboundLine_variantId_idx" ON "DistributorOutboundLine"("variantId");

-- AddForeignKey
ALTER TABLE "DistributorOutboundInvoice" ADD CONSTRAINT "DistributorOutboundInvoice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DistributorOutboundInvoice" ADD CONSTRAINT "DistributorOutboundInvoice_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "DistributorQuote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DistributorOutboundLine" ADD CONSTRAINT "DistributorOutboundLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "DistributorOutboundInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DistributorOutboundLine" ADD CONSTRAINT "DistributorOutboundLine_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "DistributorVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
