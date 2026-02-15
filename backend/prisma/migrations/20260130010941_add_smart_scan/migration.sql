-- CreateTable
CREATE TABLE "organization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "inviteCode" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "organization_member" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "organization_member_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "organization_member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "reminder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "reminderDate" DATETIME NOT NULL,
    "note" TEXT,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "notificationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "reminder_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_item" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "prep_item" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "itemType" TEXT NOT NULL DEFAULT 'ingredient',
    "parLevel" REAL NOT NULL,
    "currentLevel" REAL NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "organizationId" TEXT,
    CONSTRAINT "prep_item_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "prep_log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "prepItemId" TEXT NOT NULL,
    "quantityPrepped" REAL NOT NULL,
    "preppedBy" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "prep_log_prepItemId_fkey" FOREIGN KEY ("prepItemId") REFERENCES "prep_item" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "cycle_count" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "organizationId" TEXT,
    CONSTRAINT "cycle_count_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "cycle_count_item" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cycleCountId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "expectedQty" INTEGER NOT NULL,
    "countedQty" INTEGER,
    "variance" INTEGER,
    "notes" TEXT,
    "countedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "cycle_count_item_cycleCountId_fkey" FOREIGN KEY ("cycleCountId") REFERENCES "cycle_count" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "cycle_count_item_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_item" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScanSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "imageUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'uploaded',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScanSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScanResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scanSessionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "confidence" REAL,
    "inventoryItemId" TEXT,
    CONSTRAINT "ScanResult_scanSessionId_fkey" FOREIGN KEY ("scanSessionId") REFERENCES "ScanSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_inventory_item" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT NOT NULL,
    "binNumber" TEXT NOT NULL,
    "rackNumber" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "parLevel" INTEGER,
    "cost" REAL,
    "soldAt" DATETIME,
    "soldPrice" REAL,
    "shipByDate" DATETIME,
    "shipperQrCode" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "organizationId" TEXT,
    CONSTRAINT "inventory_item_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_inventory_item" ("binNumber", "createdAt", "description", "id", "imageUrl", "name", "parLevel", "platform", "rackNumber", "soldAt", "soldPrice", "status", "updatedAt") SELECT "binNumber", "createdAt", "description", "id", "imageUrl", "name", "parLevel", "platform", "rackNumber", "soldAt", "soldPrice", "status", "updatedAt" FROM "inventory_item";
DROP TABLE "inventory_item";
ALTER TABLE "new_inventory_item" RENAME TO "inventory_item";
CREATE TABLE "new_order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderNumber" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "notes" TEXT,
    "submittedAt" DATETIME,
    "receivedAt" DATETIME,
    "totalAmount" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "organizationId" TEXT,
    CONSTRAINT "order_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendor" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "order_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_order" ("createdAt", "id", "notes", "orderNumber", "organizationId", "receivedAt", "status", "submittedAt", "totalAmount", "updatedAt", "vendorId") SELECT "createdAt", "id", "notes", "orderNumber", "organizationId", "receivedAt", "status", "submittedAt", "totalAmount", "updatedAt", "vendorId" FROM "order";
DROP TABLE "order";
ALTER TABLE "new_order" RENAME TO "order";
CREATE TABLE "new_vendor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "organizationId" TEXT,
    CONSTRAINT "vendor_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_vendor" ("address", "contactName", "createdAt", "email", "id", "name", "notes", "organizationId", "phone", "updatedAt") SELECT "address", "contactName", "createdAt", "email", "id", "name", "notes", "organizationId", "phone", "updatedAt" FROM "vendor";
DROP TABLE "vendor";
ALTER TABLE "new_vendor" RENAME TO "vendor";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "organization_inviteCode_key" ON "organization"("inviteCode");

-- CreateIndex
CREATE UNIQUE INDEX "organization_member_organizationId_userId_key" ON "organization_member"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "cycle_count_item_cycleCountId_inventoryItemId_key" ON "cycle_count_item"("cycleCountId", "inventoryItemId");

-- CreateIndex
CREATE INDEX "ScanSession_userId_idx" ON "ScanSession"("userId");

-- CreateIndex
CREATE INDEX "ScanResult_scanSessionId_idx" ON "ScanResult"("scanSessionId");
