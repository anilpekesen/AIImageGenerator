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

export async function markAudited(id, appliedFields) {
  return prisma.seoAudit.update({
    where: { id },
    data: { appliedAt: new Date() },
  });
}

export async function getLatestAudit(shop, productId) {
  return prisma.seoAudit.findFirst({
    where: { shop, productId },
    orderBy: { createdAt: "desc" },
  });
}

export async function countAudits(shop) {
  return prisma.seoAudit.count({ where: { shop } });
}
