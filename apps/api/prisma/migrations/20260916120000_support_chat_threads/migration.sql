-- CreateEnum
CREATE TYPE "SupportScope" AS ENUM ('CONSULTORIA', 'CLIENTE');

-- CreateEnum
CREATE TYPE "SupportThreadStatus" AS ENUM ('AI', 'HUMAN');

-- CreateEnum
CREATE TYPE "SupportMessageRole" AS ENUM ('USER', 'ASSISTANT', 'HUMAN_SUPPORT', 'SYSTEM');

-- CreateTable
CREATE TABLE "SupportThread" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "servedClientId" TEXT,
    "contextKey" TEXT NOT NULL,
    "userId" TEXT,
    "scope" "SupportScope" NOT NULL,
    "status" "SupportThreadStatus" NOT NULL DEFAULT 'AI',
    "lastMessageAt" TIMESTAMP(3),
    "humanRequestedAt" TIMESTAMP(3),
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportMessage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "servedClientId" TEXT,
    "threadId" TEXT NOT NULL,
    "role" "SupportMessageRole" NOT NULL,
    "body" TEXT NOT NULL,
    "authorUserId" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupportThread_organizationId_userId_scope_contextKey_key" ON "SupportThread"("organizationId", "userId", "scope", "contextKey");

-- CreateIndex
CREATE INDEX "SupportThread_organizationId_scope_status_idx" ON "SupportThread"("organizationId", "scope", "status");

-- CreateIndex
CREATE INDEX "SupportThread_organizationId_userId_contextKey_idx" ON "SupportThread"("organizationId", "userId", "contextKey");

-- CreateIndex
CREATE INDEX "SupportThread_servedClientId_idx" ON "SupportThread"("servedClientId");

-- CreateIndex
CREATE INDEX "SupportThread_userId_idx" ON "SupportThread"("userId");

-- CreateIndex
CREATE INDEX "SupportMessage_organizationId_createdAt_idx" ON "SupportMessage"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "SupportMessage_threadId_createdAt_idx" ON "SupportMessage"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX "SupportMessage_servedClientId_idx" ON "SupportMessage"("servedClientId");

-- AddForeignKey
ALTER TABLE "SupportThread" ADD CONSTRAINT "SupportThread_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportThread" ADD CONSTRAINT "SupportThread_servedClientId_fkey" FOREIGN KEY ("servedClientId") REFERENCES "ServedClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportThread" ADD CONSTRAINT "SupportThread_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_servedClientId_fkey" FOREIGN KEY ("servedClientId") REFERENCES "ServedClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "SupportThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
