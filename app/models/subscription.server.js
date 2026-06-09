import { prisma } from "../shopify.server";

function getNextResetDate() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1);
}

export async function getOrCreateSubscription(shop) {
  let subscription = await prisma.subscription.findUnique({ where: { shop } });

  if (!subscription) {
    subscription = await prisma.subscription.create({
      data: {
        shop,
        plan: "free",
        usedCount: 0,
        limitCount: 5,
        resetDate: getNextResetDate(),
        isActive: true,
      },
    });
  }

  // Ay başında sayacı sıfırla
  if (new Date() >= new Date(subscription.resetDate)) {
    subscription = await prisma.subscription.update({
      where: { shop },
      data: { usedCount: 0, resetDate: getNextResetDate() },
    });
  }

  return subscription;
}

export async function decrementUsage(shop) {
  return prisma.subscription.update({
    where: { shop },
    data: { usedCount: { increment: 1 } },
  });
}

export async function upgradePlan(shop, plan, chargeId) {
  const limits = { free: 8, solo: 150, pro: 750, premium: 2000 };
  return prisma.subscription.update({
    where: { shop },
    data: {
      plan,
      limitCount: limits[plan] ?? 8,
      chargeId,
      isActive: true,
    },
  });
}
