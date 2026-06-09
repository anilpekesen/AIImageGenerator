import { prisma } from "../shopify.server";

export async function createGeneration({ shop, productId, productTitle, inputImage }) {
  return prisma.generation.create({
    data: {
      shop,
      productId,
      productTitle,
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
  return prisma.generation.findFirst({ where: { id, shop } });
}
