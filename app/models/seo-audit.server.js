import { prisma } from "../shopify.server";

export async function createSeoAudit({ shop, productId, productTitle, score, issues, suggestions }) {
  return prisma.seoAudit.create({
    data: {
      shop,
      productId,
      productTitle,
      score,
      issues: JSON.stringify(issues),
      suggestions: JSON.stringify(suggestions),
    },
  });
}

export async function markAudited(id, appliedFieldNames = []) {
  const existing = await prisma.seoAudit.findUnique({ where: { id } });
  const previousFields = existing ? JSON.parse(existing.appliedFields || "[]") : [];
  const mergedFields = Array.from(new Set([...previousFields, ...appliedFieldNames]));

  return prisma.seoAudit.update({
    where: { id },
    data: {
      appliedAt: new Date(),
      appliedFields: JSON.stringify(mergedFields),
    },
  });
}

export async function getLatestAppliedMap(shop) {
  const audits = await prisma.seoAudit.findMany({
    where: { shop, appliedAt: { not: null } },
    orderBy: { appliedAt: "desc" },
  });

  const map = {};
  for (const audit of audits) {
    if (!map[audit.productId]) {
      map[audit.productId] = {
        appliedAt: audit.appliedAt,
        appliedFields: JSON.parse(audit.appliedFields || "[]"),
        score: audit.score,
      };
    }
  }
  return map;
}

export async function getLatestAudit(shop, productId) {
  return prisma.seoAudit.findFirst({
    where: { shop, productId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getAuditHistory(shop, productId, limit = 10) {
  return prisma.seoAudit.findMany({
    where: { shop, productId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getAuditById(id, shop) {
  return prisma.seoAudit.findFirst({ where: { id, shop } });
}

export async function countAudits(shop) {
  return prisma.seoAudit.count({ where: { shop } });
}
