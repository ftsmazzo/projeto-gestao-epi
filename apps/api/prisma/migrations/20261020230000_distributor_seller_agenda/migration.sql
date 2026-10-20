-- CreateTable
CREATE TABLE "DistributorCustomer" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cnpj" TEXT,
    "phone" TEXT,
    "city" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DistributorCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DistributorVisit" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "sellerUserId" TEXT NOT NULL,
    "visitedAt" TIMESTAMP(3) NOT NULL,
    "summary" TEXT NOT NULL,
    "nextAction" TEXT,
    "quoteId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DistributorVisit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DistributorCustomer_organizationId_name_idx" ON "DistributorCustomer"("organizationId", "name");
CREATE INDEX "DistributorCustomer_organizationId_cnpj_idx" ON "DistributorCustomer"("organizationId", "cnpj");
CREATE INDEX "DistributorVisit_organizationId_customerId_visitedAt_idx" ON "DistributorVisit"("organizationId", "customerId", "visitedAt");
CREATE INDEX "DistributorVisit_organizationId_sellerUserId_visitedAt_idx" ON "DistributorVisit"("organizationId", "sellerUserId", "visitedAt");
CREATE INDEX "DistributorVisit_quoteId_idx" ON "DistributorVisit"("quoteId");

-- AddForeignKey
ALTER TABLE "DistributorCustomer" ADD CONSTRAINT "DistributorCustomer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DistributorVisit" ADD CONSTRAINT "DistributorVisit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DistributorVisit" ADD CONSTRAINT "DistributorVisit_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "DistributorCustomer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DistributorVisit" ADD CONSTRAINT "DistributorVisit_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "DistributorQuote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
