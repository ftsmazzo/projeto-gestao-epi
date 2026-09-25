-- CreateEnum
CREATE TYPE "SstDocumentsAccessScope" AS ENUM ('MANAGERS_ONLY', 'MANAGERS_AND_OPERATORS');

-- AlterTable
ALTER TABLE "ServedClient"
ADD COLUMN "sstDocumentsAccessScope" "SstDocumentsAccessScope" NOT NULL DEFAULT 'MANAGERS_ONLY';

-- Clientes que ja tinham SST liberado: manter acesso de operadores (comportamento anterior).
UPDATE "ServedClient"
SET "sstDocumentsAccessScope" = 'MANAGERS_AND_OPERATORS'
WHERE "sstDocumentsEnabled" = true;
