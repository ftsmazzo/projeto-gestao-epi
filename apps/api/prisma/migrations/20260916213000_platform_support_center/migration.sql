-- CreateEnum
CREATE TYPE "SupportLifecycleStatus" AS ENUM ('ACTIVE', 'WAITING_HUMAN', 'IN_PROGRESS', 'RESOLVED');

-- AlterTable
ALTER TABLE "SupportThread"
ADD COLUMN "lifecycleStatus" "SupportLifecycleStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "assignedToUserId" TEXT,
ADD COLUMN "firstHumanResponseAt" TIMESTAMP(3),
ADD COLUMN "resolvedAt" TIMESTAMP(3);

-- Existing human threads enter the platform queue.
UPDATE "SupportThread"
SET "lifecycleStatus" = 'WAITING_HUMAN'
WHERE "status" = 'HUMAN';

-- CreateIndex
CREATE INDEX "SupportThread_lifecycleStatus_humanRequestedAt_idx"
ON "SupportThread"("lifecycleStatus", "humanRequestedAt");

-- CreateIndex
CREATE INDEX "SupportThread_assignedToUserId_lifecycleStatus_idx"
ON "SupportThread"("assignedToUserId", "lifecycleStatus");

-- AddForeignKey
ALTER TABLE "SupportThread"
ADD CONSTRAINT "SupportThread_assignedToUserId_fkey"
FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
