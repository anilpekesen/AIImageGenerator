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
        limitCount: 10,
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
  const limits = { free: 10, basic: 100, pro: 500 };
  return prisma.subscription.update({
    where: { shop },
    data: {
      plan,
      limitCount: limits[plan] ?? 10,
      chargeId,
      isActive: true,
    },
  });
}
