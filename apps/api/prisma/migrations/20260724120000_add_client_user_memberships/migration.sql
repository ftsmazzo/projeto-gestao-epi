-- CreateEnum
CREATE TYPE "ClientUserRole" AS ENUM ('CLIENT_MANAGER', 'STOCK_OPERATOR', 'WORKER');

-- CreateEnum
CREATE TYPE "ClientUserInviteStatus" AS ENUM ('PREPARED', 'LINKED');

-- CreateTable
CREATE TABLE "ClientUserMembership" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "servedClientId" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "ClientUserRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "inviteStatus" "ClientUserInviteStatus" NOT NULL DEFAULT 'PREPARED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientUserMembership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientUserMembership_organizationId_idx" ON "ClientUserMembership"("organizationId");

-- CreateIndex
CREATE INDEX "ClientUserMembership_servedClientId_idx" ON "ClientUserMembership"("servedClientId");

-- CreateIndex
CREATE INDEX "ClientUserMembership_userId_idx" ON "ClientUserMembership"("userId");

-- CreateIndex
CREATE INDEX "ClientUserMembership_role_isActive_idx" ON "ClientUserMembership"("role", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ClientUserMembership_servedClientId_email_key" ON "ClientUserMembership"("servedClientId", "email");

-- AddForeignKey
ALTER TABLE "ClientUserMembership" ADD CONSTRAINT "ClientUserMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientUserMembership" ADD CONSTRAINT "ClientUserMembership_servedClientId_fkey" FOREIGN KEY ("servedClientId") REFERENCES "ServedClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientUserMembership" ADD CONSTRAINT "ClientUserMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
