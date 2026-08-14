-- Texto do PGR/PDF/DOCX para remineracao reversa (planilha → riscos/EPIs).
ALTER TABLE "PgroImportRun" ADD COLUMN IF NOT EXISTS "sourceText" TEXT;
