-- AlterTable
ALTER TABLE "EpiItem" ADD COLUMN "defaultUnitPriceCents" INTEGER,
ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'BRL';

-- AlterTable
ALTER TABLE "EpiStockMovement" ADD COLUMN "unitCostCents" INTEGER,
ADD COLUMN "totalCostCents" INTEGER,
ADD COLUMN "invoiceDocumentId" TEXT;

-- CreateTable
CREATE TABLE "InvoiceDocument" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "servedClientId" TEXT,
    "number" TEXT,
    "supplierName" TEXT,
    "issuedAt" TIMESTAMP(3),
    "filePath" TEXT NOT NULL,
    "fileHash" TEXT,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "notes" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InvoiceDocument_organizationId_idx" ON "InvoiceDocument"("organizationId");

-- CreateIndex
CREATE INDEX "InvoiceDocument_servedClientId_idx" ON "InvoiceDocument"("servedClientId");

-- CreateIndex
CREATE INDEX "InvoiceDocument_createdAt_idx" ON "InvoiceDocument"("createdAt");

-- CreateIndex
CREATE INDEX "EpiStockMovement_invoiceDocumentId_idx" ON "EpiStockMovement"("invoiceDocumentId");

-- AddForeignKey
ALTER TABLE "InvoiceDocument" ADD CONSTRAINT "InvoiceDocument_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceDocument" ADD CONSTRAINT "InvoiceDocument_servedClientId_fkey" FOREIGN KEY ("servedClientId") REFERENCES "ServedClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceDocument" ADD CONSTRAINT "InvoiceDocument_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EpiStockMovement" ADD CONSTRAINT "EpiStockMovement_invoiceDocumentId_fkey" FOREIGN KEY ("invoiceDocumentId") REFERENCES "InvoiceDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
