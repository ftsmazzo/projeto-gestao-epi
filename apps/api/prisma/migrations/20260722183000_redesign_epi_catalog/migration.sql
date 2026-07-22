-- CreateEnum
CREATE TYPE "EpiUnitOfMeasure" AS ENUM ('UNIDADE', 'PAR', 'CAIXA', 'KIT');

-- CreateEnum
CREATE TYPE "EpiUsefulLifeUnit" AS ENUM ('DIAS', 'MESES', 'ANOS');

-- CreateEnum
CREATE TYPE "EpiCategory" AS ENUM ('AUDITIVA', 'RESPIRATORIA', 'QUEDA', 'MAOS', 'OLHOS', 'CABECA', 'PES', 'TRONCO', 'OUTROS');

-- AlterTable: add new columns
ALTER TABLE "EpiItem" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "EpiItem" ADD COLUMN "caExpiresAt" TIMESTAMP(3);
ALTER TABLE "EpiItem" ADD COLUMN "unitOfMeasure" "EpiUnitOfMeasure" NOT NULL DEFAULT 'UNIDADE';
ALTER TABLE "EpiItem" ADD COLUMN "usefulLifeValue" INTEGER;
ALTER TABLE "EpiItem" ADD COLUMN "usefulLifeUnit" "EpiUsefulLifeUnit";
ALTER TABLE "EpiItem" ADD COLUMN "externalCode" TEXT;
ALTER TABLE "EpiItem" ADD COLUMN "manufacturerName" TEXT;
ALTER TABLE "EpiItem" ADD COLUMN "reference" TEXT;
ALTER TABLE "EpiItem" ADD COLUMN "color" TEXT;
ALTER TABLE "EpiItem" ADD COLUMN "approvedFor" TEXT;
ALTER TABLE "EpiItem" ADD COLUMN "restriction" TEXT;
ALTER TABLE "EpiItem" ADD COLUMN "technicalNotes" TEXT;
ALTER TABLE "EpiItem" ADD COLUMN "nrr" DOUBLE PRECISION;
ALTER TABLE "EpiItem" ADD COLUMN "nrrsf" DOUBLE PRECISION;
ALTER TABLE "EpiItem" ADD COLUMN "categoryEnum" "EpiCategory";

-- Migrate existing data
UPDATE "EpiItem"
SET
  "isActive" = ("status" = 'ACTIVE'),
  "caExpiresAt" = "caExpirationDate",
  "manufacturerName" = "manufacturer",
  "technicalNotes" = "notes",
  "usefulLifeValue" = "defaultValidityDays",
  "usefulLifeUnit" = CASE
    WHEN "defaultValidityDays" IS NOT NULL THEN 'DIAS'::"EpiUsefulLifeUnit"
    ELSE NULL
  END,
  "categoryEnum" = CASE
    WHEN UPPER(TRIM(COALESCE("category", ''))) IN ('AUDITIVA', 'PROTECAO AUDITIVA') THEN 'AUDITIVA'::"EpiCategory"
    WHEN UPPER(TRIM(COALESCE("category", ''))) IN ('RESPIRATORIA', 'PROTECAO RESPIRATORIA') THEN 'RESPIRATORIA'::"EpiCategory"
    WHEN UPPER(TRIM(COALESCE("category", ''))) IN ('QUEDA', 'QUEDAS') THEN 'QUEDA'::"EpiCategory"
    WHEN UPPER(TRIM(COALESCE("category", ''))) IN ('MAOS', 'MÃOS', 'MAO', 'MÃO') THEN 'MAOS'::"EpiCategory"
    WHEN UPPER(TRIM(COALESCE("category", ''))) IN ('OLHOS', 'OCULAR') THEN 'OLHOS'::"EpiCategory"
    WHEN UPPER(TRIM(COALESCE("category", ''))) IN ('CABECA', 'CABEÇA') THEN 'CABECA'::"EpiCategory"
    WHEN UPPER(TRIM(COALESCE("category", ''))) IN ('PES', 'PÉS', 'PE', 'PÉ') THEN 'PES'::"EpiCategory"
    WHEN UPPER(TRIM(COALESCE("category", ''))) IN ('TRONCO') THEN 'TRONCO'::"EpiCategory"
    WHEN "category" IS NULL OR TRIM("category") = '' THEN NULL
    ELSE 'OUTROS'::"EpiCategory"
  END;

-- Drop old indexes/columns
DROP INDEX IF EXISTS "EpiItem_status_idx";
DROP INDEX IF EXISTS "EpiItem_category_idx";

ALTER TABLE "EpiItem" DROP COLUMN "caExpirationDate";
ALTER TABLE "EpiItem" DROP COLUMN "manufacturer";
ALTER TABLE "EpiItem" DROP COLUMN "defaultValidityDays";
ALTER TABLE "EpiItem" DROP COLUMN "status";
ALTER TABLE "EpiItem" DROP COLUMN "notes";
ALTER TABLE "EpiItem" DROP COLUMN "category";

ALTER TABLE "EpiItem" RENAME COLUMN "categoryEnum" TO "category";

DROP TYPE "EpiItemStatus";

-- Recreate indexes
CREATE INDEX "EpiItem_isActive_idx" ON "EpiItem"("isActive");
CREATE INDEX "EpiItem_category_idx" ON "EpiItem"("category");
CREATE INDEX "EpiItem_externalCode_idx" ON "EpiItem"("externalCode");

-- CreateTable EpiVariant
CREATE TABLE "EpiVariant" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "epiItemId" TEXT NOT NULL,
    "size" TEXT,
    "color" TEXT,
    "model" TEXT,
    "side" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EpiVariant_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EpiVariant_organizationId_idx" ON "EpiVariant"("organizationId");
CREATE INDEX "EpiVariant_epiItemId_idx" ON "EpiVariant"("epiItemId");
CREATE INDEX "EpiVariant_isActive_idx" ON "EpiVariant"("isActive");

ALTER TABLE "EpiVariant" ADD CONSTRAINT "EpiVariant_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EpiVariant" ADD CONSTRAINT "EpiVariant_epiItemId_fkey" FOREIGN KEY ("epiItemId") REFERENCES "EpiItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
