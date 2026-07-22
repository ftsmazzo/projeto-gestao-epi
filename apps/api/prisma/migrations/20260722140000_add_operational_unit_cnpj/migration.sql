-- AlterTable
ALTER TABLE "OperationalUnit" ADD COLUMN "cnpj" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "OperationalUnit_organizationId_cnpj_key" ON "OperationalUnit"("organizationId", "cnpj");
