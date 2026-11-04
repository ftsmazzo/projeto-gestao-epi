-- Expand customer master + create supplier master; link documents with FK + snapshot.

ALTER TABLE "DistributorCustomer" ADD COLUMN "email" TEXT;
ALTER TABLE "DistributorCustomer" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "DistributorCustomer" ADD COLUMN "stateRegistration" TEXT;
ALTER TABLE "DistributorCustomer" ADD COLUMN "uf" TEXT;
ALTER TABLE "DistributorCustomer" ADD COLUMN "street" TEXT;
ALTER TABLE "DistributorCustomer" ADD COLUMN "number" TEXT;
ALTER TABLE "DistributorCustomer" ADD COLUMN "complement" TEXT;
ALTER TABLE "DistributorCustomer" ADD COLUMN "district" TEXT;
ALTER TABLE "DistributorCustomer" ADD COLUMN "zipCode" TEXT;

CREATE INDEX "DistributorCustomer_organizationId_active_idx" ON "DistributorCustomer"("organizationId", "active");

CREATE TABLE "DistributorSupplier" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cnpj" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "stateRegistration" TEXT,
    "uf" TEXT,
    "street" TEXT,
    "number" TEXT,
    "complement" TEXT,
    "district" TEXT,
    "city" TEXT,
    "zipCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DistributorSupplier_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DistributorSupplier_organizationId_name_idx" ON "DistributorSupplier"("organizationId", "name");
CREATE INDEX "DistributorSupplier_organizationId_cnpj_idx" ON "DistributorSupplier"("organizationId", "cnpj");
CREATE INDEX "DistributorSupplier_organizationId_active_idx" ON "DistributorSupplier"("organizationId", "active");

ALTER TABLE "DistributorSupplier" ADD CONSTRAINT "DistributorSupplier_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DistributorQuote" ADD COLUMN "customerId" TEXT;
CREATE INDEX "DistributorQuote_customerId_idx" ON "DistributorQuote"("customerId");
ALTER TABLE "DistributorQuote" ADD CONSTRAINT "DistributorQuote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "DistributorCustomer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DistributorOutboundInvoice" ADD COLUMN "customerId" TEXT;
CREATE INDEX "DistributorOutboundInvoice_customerId_idx" ON "DistributorOutboundInvoice"("customerId");
ALTER TABLE "DistributorOutboundInvoice" ADD CONSTRAINT "DistributorOutboundInvoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "DistributorCustomer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DistributorReceivable" ADD COLUMN "customerId" TEXT;
CREATE INDEX "DistributorReceivable_customerId_idx" ON "DistributorReceivable"("customerId");
ALTER TABLE "DistributorReceivable" ADD CONSTRAINT "DistributorReceivable_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "DistributorCustomer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DistributorPurchaseOrder" ADD COLUMN "supplierId" TEXT;
CREATE INDEX "DistributorPurchaseOrder_supplierId_idx" ON "DistributorPurchaseOrder"("supplierId");
ALTER TABLE "DistributorPurchaseOrder" ADD CONSTRAINT "DistributorPurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "DistributorSupplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DistributorPayable" ADD COLUMN "supplierId" TEXT;
CREATE INDEX "DistributorPayable_supplierId_idx" ON "DistributorPayable"("supplierId");
ALTER TABLE "DistributorPayable" ADD CONSTRAINT "DistributorPayable_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "DistributorSupplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DistributorInboundDocument" ADD COLUMN "supplierId" TEXT;
CREATE INDEX "DistributorInboundDocument_supplierId_idx" ON "DistributorInboundDocument"("supplierId");
ALTER TABLE "DistributorInboundDocument" ADD CONSTRAINT "DistributorInboundDocument_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "DistributorSupplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
