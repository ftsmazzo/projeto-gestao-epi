-- CreateTable
CREATE TABLE "EpiNeed" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "EpiCategory",
    "description" TEXT,
    "aliases" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EpiNeed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EpiItemNeed" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "epiItemId" TEXT NOT NULL,
    "epiNeedId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EpiItemNeed_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EpiNeed_organizationId_idx" ON "EpiNeed"("organizationId");

-- CreateIndex
CREATE INDEX "EpiNeed_isActive_idx" ON "EpiNeed"("isActive");

-- CreateIndex
CREATE INDEX "EpiNeed_category_idx" ON "EpiNeed"("category");

-- Unique name per tenant (case-insensitive)
CREATE UNIQUE INDEX "EpiNeed_organizationId_name_ci_uidx"
ON "EpiNeed" ("organizationId", (LOWER("name")));

-- CreateIndex
CREATE INDEX "EpiItemNeed_organizationId_idx" ON "EpiItemNeed"("organizationId");

-- CreateIndex
CREATE INDEX "EpiItemNeed_epiItemId_idx" ON "EpiItemNeed"("epiItemId");

-- CreateIndex
CREATE INDEX "EpiItemNeed_epiNeedId_idx" ON "EpiItemNeed"("epiNeedId");

-- CreateIndex
CREATE UNIQUE INDEX "EpiItemNeed_organizationId_epiItemId_epiNeedId_key" ON "EpiItemNeed"("organizationId", "epiItemId", "epiNeedId");

-- AddForeignKey
ALTER TABLE "EpiNeed" ADD CONSTRAINT "EpiNeed_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EpiItemNeed" ADD CONSTRAINT "EpiItemNeed_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EpiItemNeed" ADD CONSTRAINT "EpiItemNeed_epiItemId_fkey" FOREIGN KEY ("epiItemId") REFERENCES "EpiItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EpiItemNeed" ADD CONSTRAINT "EpiItemNeed_epiNeedId_fkey" FOREIGN KEY ("epiNeedId") REFERENCES "EpiNeed"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
