-- CreateTable
CREATE TABLE "ClientGroup" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientGroupMember" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "servedClientId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientGroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientGroup_organizationId_idx" ON "ClientGroup"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientGroup_organizationId_name_key" ON "ClientGroup"("organizationId", "name");

-- CreateIndex
CREATE INDEX "ClientGroupMember_organizationId_idx" ON "ClientGroupMember"("organizationId");

-- CreateIndex
CREATE INDEX "ClientGroupMember_groupId_idx" ON "ClientGroupMember"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientGroupMember_servedClientId_key" ON "ClientGroupMember"("servedClientId");

-- AddForeignKey
ALTER TABLE "ClientGroup" ADD CONSTRAINT "ClientGroup_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientGroupMember" ADD CONSTRAINT "ClientGroupMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientGroupMember" ADD CONSTRAINT "ClientGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ClientGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientGroupMember" ADD CONSTRAINT "ClientGroupMember_servedClientId_fkey" FOREIGN KEY ("servedClientId") REFERENCES "ServedClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
