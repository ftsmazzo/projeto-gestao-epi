-- AlterTable
ALTER TABLE "InvoiceDocument" ADD COLUMN "extractedJson" JSONB,
ADD COLUMN "extractedAt" TIMESTAMP(3),
ADD COLUMN "extractionMethod" TEXT;
