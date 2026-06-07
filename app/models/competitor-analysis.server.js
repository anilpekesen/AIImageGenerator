import { prisma } from "../shopify.server";

export async function createCompetitorAnalysis({ shop, productId, productTitle, query, results, aiSummary }) {
  return prisma.competitorAnalysis.create({
    data: {
      shop,
      productId,
      productTitle,
      query,
      results: JSON.stringify(results),
      aiSummary,
    },
  });
}

export async function getLatestAnalysis(shop, productId) {
  return prisma.competitorAnalysis.findFirst({
    where: { shop, productId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getAnalysisHistory(shop, limit = 20) {
  return prisma.competitorAnalysis.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
