-- Outbox de comunicacoes (e-mail / WhatsApp).
CREATE TYPE "CommunicationChannel" AS ENUM ('EMAIL', 'WHATSAPP');
CREATE TYPE "CommunicationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

CREATE TABLE "CommunicationOutbox" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "channel" "CommunicationChannel" NOT NULL,
    "templateKey" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "subject" TEXT,
    "bodyText" TEXT NOT NULL,
    "payload" JSONB,
    "status" "CommunicationStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "relatedType" TEXT,
    "relatedId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "CommunicationOutbox_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CommunicationOutbox_organizationId_idx" ON "CommunicationOutbox"("organizationId");
CREATE INDEX "CommunicationOutbox_status_createdAt_idx" ON "CommunicationOutbox"("status", "createdAt");
CREATE INDEX "CommunicationOutbox_relatedType_relatedId_idx" ON "CommunicationOutbox"("relatedType", "relatedId");

ALTER TABLE "CommunicationOutbox" ADD CONSTRAINT "CommunicationOutbox_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
