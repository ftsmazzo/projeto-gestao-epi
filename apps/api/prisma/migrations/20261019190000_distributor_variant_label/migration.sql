-- Variante sem nome aparece como tamanho unico.
UPDATE "DistributorVariant" AS variant
SET "label" = 'Único'
WHERE btrim(variant."label") = ''
  AND NOT EXISTS (
    SELECT 1
    FROM "DistributorVariant" AS other
    WHERE other."productId" = variant."productId"
      AND other."label" = 'Único'
  );
