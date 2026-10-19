-- CreateEnum
CREATE TYPE "DistributorQuoteStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "DistributorSellerCeiling" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "maxDiscountBps" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DistributorSellerCeiling_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DistributorQuote" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "sellerUserId" TEXT NOT NULL,
    "status" "DistributorQuoteStatus" NOT NULL,
    "grantedCents" INTEGER NOT NULL,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedByUserId" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DistributorQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DistributorQuoteLine" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "discountBps" INTEGER NOT NULL,

    CONSTRAINT "DistributorQuoteLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DistributorSellerCeiling_organizationId_userId_key" ON "DistributorSellerCeiling"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "DistributorSellerCeiling_organizationId_idx" ON "DistributorSellerCeiling"("organizationId");

-- CreateIndex
CREATE INDEX "DistributorQuote_organizationId_status_approvedAt_idx" ON "DistributorQuote"("organizationId", "status", "approvedAt");

-- CreateIndex
CREATE INDEX "DistributorQuoteLine_quoteId_idx" ON "DistributorQuoteLine"("quoteId");

-- CreateIndex
CREATE INDEX "DistributorQuoteLine_variantId_idx" ON "DistributorQuoteLine"("variantId");

-- AddForeignKey
ALTER TABLE "DistributorSellerCeiling" ADD CONSTRAINT "DistributorSellerCeiling_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistributorQuote" ADD CONSTRAINT "DistributorQuote_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistributorQuoteLine" ADD CONSTRAINT "DistributorQuoteLine_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "DistributorQuote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistributorQuoteLine" ADD CONSTRAINT "DistributorQuoteLine_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "DistributorVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
