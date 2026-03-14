-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "owner" TEXT,
    "workspace" TEXT NOT NULL,
    "zapierZapId" TEXT,
    "zapierEditUrl" TEXT,
    "triggerApp" TEXT,
    "actionApps" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Dependency" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dependentId" TEXT NOT NULL,
    "dependencyId" TEXT NOT NULL,
    "relationshipType" TEXT NOT NULL,
    CONSTRAINT "Dependency_dependentId_fkey" FOREIGN KEY ("dependentId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Dependency_dependencyId_fkey" FOREIGN KEY ("dependencyId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "details" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Dependency_dependentId_idx" ON "Dependency"("dependentId");

-- CreateIndex
CREATE INDEX "Dependency_dependencyId_idx" ON "Dependency"("dependencyId");

-- CreateIndex
CREATE UNIQUE INDEX "Dependency_dependentId_dependencyId_relationshipType_key" ON "Dependency"("dependentId", "dependencyId", "relationshipType");

-- CreateIndex
CREATE INDEX "AuditLog_assetId_idx" ON "AuditLog"("assetId");
