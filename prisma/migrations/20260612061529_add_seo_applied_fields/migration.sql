-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SeoAudit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productTitle" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "issues" TEXT NOT NULL DEFAULT '[]',
    "suggestions" TEXT NOT NULL DEFAULT '{}',
    "appliedAt" DATETIME,
    "appliedFields" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_SeoAudit" ("appliedAt", "createdAt", "id", "issues", "productId", "productTitle", "score", "shop", "suggestions") SELECT "appliedAt", "createdAt", "id", "issues", "productId", "productTitle", "score", "shop", "suggestions" FROM "SeoAudit";
DROP TABLE "SeoAudit";
ALTER TABLE "new_SeoAudit" RENAME TO "SeoAudit";
CREATE INDEX "SeoAudit_shop_idx" ON "SeoAudit"("shop");
CREATE INDEX "SeoAudit_shop_productId_idx" ON "SeoAudit"("shop", "productId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
