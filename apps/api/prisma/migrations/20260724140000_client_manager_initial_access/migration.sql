-- CreateEnum
CREATE TYPE "ClientUserAccessStatus" AS ENUM ('PREPARED', 'INVITED', 'ACTIVE', 'DISABLED');

-- AlterTable
ALTER TABLE "ClientUserMembership" ADD COLUMN "phone" TEXT;
ALTER TABLE "ClientUserMembership" ADD COLUMN "accessStatus" "ClientUserAccessStatus" NOT NULL DEFAULT 'PREPARED';
ALTER TABLE "ClientUserMembership" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ClientUserMembership" ADD COLUMN "temporaryPasswordCreatedAt" TIMESTAMP(3);

-- Migrate old inviteStatus values
UPDATE "ClientUserMembership"
SET "accessStatus" = CASE
  WHEN "inviteStatus"::text = 'LINKED' THEN 'ACTIVE'::"ClientUserAccessStatus"
  ELSE 'PREPARED'::"ClientUserAccessStatus"
END;

-- Drop old column + enum
ALTER TABLE "ClientUserMembership" DROP COLUMN "inviteStatus";
DROP TYPE "ClientUserInviteStatus";

-- CreateIndex
CREATE INDEX "ClientUserMembership_accessStatus_idx" ON "ClientUserMembership"("accessStatus");
