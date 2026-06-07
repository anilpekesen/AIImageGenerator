-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" DATETIME,
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false
);

-- CreateTable
CREATE TABLE "Generation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productTitle" TEXT NOT NULL,
    "inputImage" TEXT NOT NULL,
    "bgRemovedImage" TEXT,
    "outputs" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "limitCount" INTEGER NOT NULL DEFAULT 10,
    "resetDate" DATETIME NOT NULL,
    "chargeId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CompetitorAnalysis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productTitle" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "results" TEXT NOT NULL DEFAULT '[]',
    "aiSummary" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SeoAudit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productTitle" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "issues" TEXT NOT NULL DEFAULT '[]',
    "suggestions" TEXT NOT NULL DEFAULT '{}',
    "appliedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Generation_shop_idx" ON "Generation"("shop");

-- CreateIndex
CREATE INDEX "Generation_shop_productId_idx" ON "Generation"("shop", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_shop_key" ON "Subscription"("shop");

-- CreateIndex
CREATE INDEX "CompetitorAnalysis_shop_idx" ON "CompetitorAnalysis"("shop");

-- CreateIndex
CREATE INDEX "CompetitorAnalysis_shop_productId_idx" ON "CompetitorAnalysis"("shop", "productId");

-- CreateIndex
CREATE INDEX "SeoAudit_shop_idx" ON "SeoAudit"("shop");

-- CreateIndex
CREATE INDEX "SeoAudit_shop_productId_idx" ON "SeoAudit"("shop", "productId");

