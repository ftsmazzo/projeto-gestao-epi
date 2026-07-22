-- CreateEnum
CREATE TYPE "OperationalUnitStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "OperationalUnit" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "servedClientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "status" "OperationalUnitStatus" NOT NULL DEFAULT 'ACTIVE',
    "addressLine" TEXT,
    "city" TEXT,
    "state" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperationalUnit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OperationalUnit_organizationId_idx" ON "OperationalUnit"("organizationId");

-- CreateIndex
CREATE INDEX "OperationalUnit_servedClientId_idx" ON "OperationalUnit"("servedClientId");

-- CreateIndex
CREATE INDEX "OperationalUnit_status_idx" ON "OperationalUnit"("status");

-- CreateIndex
CREATE UNIQUE INDEX "OperationalUnit_servedClientId_code_key" ON "OperationalUnit"("servedClientId", "code");

-- AddForeignKey
ALTER TABLE "OperationalUnit" ADD CONSTRAINT "OperationalUnit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationalUnit" ADD CONSTRAINT "OperationalUnit_servedClientId_fkey" FOREIGN KEY ("servedClientId") REFERENCES "ServedClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
