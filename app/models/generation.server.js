import { prisma } from "../shopify.server";
import { CREDIT_COSTS, refundCredits } from "./subscription.server";

// pm2 restarts during a deploy can kill an in-flight background generation,
// leaving the record stuck at "processing" forever with credits never refunded.
const STALE_GENERATION_MS = 10 * 60 * 1000;

async function failIfStale(generation) {
  if (generation.status !== "processing") return generation;
  if (Date.now() - new Date(generation.updatedAt).getTime() < STALE_GENERATION_MS) {
    return generation;
  }

  // updateMany + count guard ensures only one caller refunds credits
  // even if the status check races with another reconciliation pass.
  const result = await prisma.generation.updateMany({
    where: { id: generation.id, status: "processing" },
    data: { status: "failed" },
  });
  if (result.count === 1) {
    await refundCredits(generation.shop, CREDIT_COSTS.PHOTO_SET);
  }
  return { ...generation, status: "failed" };
}

export async function reconcileStaleGenerations(shop) {
  const cutoff = new Date(Date.now() - STALE_GENERATION_MS);
  const stale = await prisma.generation.findMany({
    where: { shop, status: "processing", updatedAt: { lt: cutoff } },
  });
  for (const generation of stale) {
    await failIfStale(generation);
  }
}

// Matches the R2 bucket's 30-day lifecycle rule on the generations/ prefix —
// once the images are gone, drop the corresponding history records too.
const GENERATION_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export async function deleteExpiredGenerations(shop) {
  const cutoff = new Date(Date.now() - GENERATION_RETENTION_MS);
  await prisma.generation.deleteMany({
    where: { shop, createdAt: { lt: cutoff } },
  });
}

export async function maintainGenerations(shop) {
  await reconcileStaleGenerations(shop);
  await deleteExpiredGenerations(shop);
}

export async function createGeneration({
  shop,
  productId,
  productTitle,
  inputImage,
  photoSetId = "general",
  photoSetLabel,
}) {
  return prisma.generation.create({
    data: {
      shop,
      productId,
      productTitle,
      photoSetId,
      photoSetLabel,
      inputImage,
      status: "processing",
      outputs: "[]",
    },
  });
}

export async function updateGeneration(id, data) {
  return prisma.generation.update({
    where: { id },
    data,
  });
}

export async function getRecentGenerations(shop, limit = 3) {
  return prisma.generation.findMany({
    where: { shop, status: "done" },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getAllGenerations(shop) {
  return prisma.generation.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
  });
}

export async function countDoneGenerations(shop) {
  return prisma.generation.count({ where: { shop, status: "done" } });
}

export async function getGenerationById(id, shop) {
  const generation = await prisma.generation.findFirst({ where: { id, shop } });
  if (!generation) return null;
  return failIfStale(generation);
}
