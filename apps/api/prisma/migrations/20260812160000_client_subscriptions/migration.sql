-- CreateEnum
CREATE TYPE "ClientSubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED');

-- CreateTable
CREATE TABLE "OrganizationLifePricing" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "unitPriceCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "defaultTrialDays" INTEGER NOT NULL DEFAULT 14,
    "defaultTrialLives" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationLifePricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LifePriceReducer" (
    "id" TEXT NOT NULL,
    "pricingId" TEXT NOT NULL,
    "minLives" INTEGER NOT NULL,
    "percentOff" INTEGER NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LifePriceReducer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientSubscription" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "servedClientId" TEXT NOT NULL,
    "status" "ClientSubscriptionStatus" NOT NULL,
    "trialLives" INTEGER,
    "trialEndsAt" TIMESTAMP(3),
    "monthlyPriceCentsOverride" INTEGER,
    "livesSnapshot" INTEGER,
    "suspendReason" TEXT,
    "suspendedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationLifePricing_organizationId_key" ON "OrganizationLifePricing"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "LifePriceReducer_pricingId_minLives_key" ON "LifePriceReducer"("pricingId", "minLives");

-- CreateIndex
CREATE INDEX "LifePriceReducer_pricingId_idx" ON "LifePriceReducer"("pricingId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientSubscription_servedClientId_key" ON "ClientSubscription"("servedClientId");

-- CreateIndex
CREATE INDEX "ClientSubscription_organizationId_idx" ON "ClientSubscription"("organizationId");

-- CreateIndex
CREATE INDEX "ClientSubscription_organizationId_status_idx" ON "ClientSubscription"("organizationId", "status");

-- AddForeignKey
ALTER TABLE "OrganizationLifePricing" ADD CONSTRAINT "OrganizationLifePricing_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LifePriceReducer" ADD CONSTRAINT "LifePriceReducer_pricingId_fkey" FOREIGN KEY ("pricingId") REFERENCES "OrganizationLifePricing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientSubscription" ADD CONSTRAINT "ClientSubscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientSubscription" ADD CONSTRAINT "ClientSubscription_servedClientId_fkey" FOREIGN KEY ("servedClientId") REFERENCES "ServedClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
