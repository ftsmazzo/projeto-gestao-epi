-- AlterTable
ALTER TABLE "Worker" ADD COLUMN "clientSectorId" TEXT;
ALTER TABLE "Worker" ADD COLUMN "clientJobFunctionId" TEXT;
ALTER TABLE "Worker" ADD COLUMN "email" TEXT;
ALTER TABLE "Worker" ADD COLUMN "phone" TEXT;

-- CreateIndex
CREATE INDEX "Worker_clientSectorId_idx" ON "Worker"("clientSectorId");
CREATE INDEX "Worker_clientJobFunctionId_idx" ON "Worker"("clientJobFunctionId");

-- AddForeignKey
ALTER TABLE "Worker" ADD CONSTRAINT "Worker_clientSectorId_fkey" FOREIGN KEY ("clientSectorId") REFERENCES "ClientSector"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Worker" ADD CONSTRAINT "Worker_clientJobFunctionId_fkey" FOREIGN KEY ("clientJobFunctionId") REFERENCES "ClientJobFunction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
