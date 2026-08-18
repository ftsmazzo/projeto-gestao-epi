-- Telefone da equipe da consultoria (User) e chave do modulo Documentos SST por cliente.

ALTER TABLE "User" ADD COLUMN "phone" TEXT;

ALTER TABLE "ServedClient" ADD COLUMN "sstDocumentsEnabled" BOOLEAN NOT NULL DEFAULT false;

-- Clientes ja cadastrados continuam com o modulo visivel; novos nascem desligados.
UPDATE "ServedClient" SET "sstDocumentsEnabled" = true;
