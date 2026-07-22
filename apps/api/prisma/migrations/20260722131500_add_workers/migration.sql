-- CreateEnum
CREATE TYPE "WorkerStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "Worker" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "servedClientId" TEXT NOT NULL,
    "operationalUnitId" TEXT,
    "name" TEXT NOT NULL,
    "cpf" TEXT,
    "registration" TEXT,
    "role" TEXT,
    "department" TEXT,
    "status" "WorkerStatus" NOT NULL DEFAULT 'ACTIVE',
    "admissionDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Worker_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Worker_organizationId_idx" ON "Worker"("organizationId");

-- CreateIndex
CREATE INDEX "Worker_servedClientId_idx" ON "Worker"("servedClientId");

-- CreateIndex
CREATE INDEX "Worker_operationalUnitId_idx" ON "Worker"("operationalUnitId");

-- CreateIndex
CREATE INDEX "Worker_status_idx" ON "Worker"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Worker_organizationId_cpf_key" ON "Worker"("organizationId", "cpf");

-- CreateIndex
CREATE UNIQUE INDEX "Worker_servedClientId_registration_key" ON "Worker"("servedClientId", "registration");

-- AddForeignKey
ALTER TABLE "Worker" ADD CONSTRAINT "Worker_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Worker" ADD CONSTRAINT "Worker_servedClientId_fkey" FOREIGN KEY ("servedClientId") REFERENCES "ServedClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Worker" ADD CONSTRAINT "Worker_operationalUnitId_fkey" FOREIGN KEY ("operationalUnitId") REFERENCES "OperationalUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
