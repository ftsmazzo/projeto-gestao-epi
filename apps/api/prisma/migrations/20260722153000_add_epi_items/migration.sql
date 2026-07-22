-- CreateEnum
CREATE TYPE "EpiItemStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "EpiItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "caNumber" TEXT,
    "caExpirationDate" TIMESTAMP(3),
    "category" TEXT,
    "manufacturer" TEXT,
    "defaultValidityDays" INTEGER,
    "requiresCa" BOOLEAN NOT NULL DEFAULT true,
    "status" "EpiItemStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EpiItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EpiItem_organizationId_idx" ON "EpiItem"("organizationId");

-- CreateIndex
CREATE INDEX "EpiItem_status_idx" ON "EpiItem"("status");

-- CreateIndex
CREATE INDEX "EpiItem_category_idx" ON "EpiItem"("category");

-- CreateIndex
CREATE UNIQUE INDEX "EpiItem_organizationId_caNumber_key" ON "EpiItem"("organizationId", "caNumber");

-- AddForeignKey
ALTER TABLE "EpiItem" ADD CONSTRAINT "EpiItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
