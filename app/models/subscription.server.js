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
        limitCount: 50,
        resetDate: getNextResetDate(),
        isActive: true,
      },
    });
  }

  if (new Date() >= new Date(subscription.resetDate)) {
    subscription = await prisma.subscription.update({
      where: { shop },
      data: { usedCount: 0, resetDate: getNextResetDate() },
    });
  }

  return subscription;
}

// credits: 6 for full set, 1 for single refine/SEO, 3 for competitor analysis
export async function decrementUsage(shop, credits = 1) {
  return prisma.subscription.update({
    where: { shop },
    data: { usedCount: { increment: credits } },
  });
}

export async function upgradePlan(shop, plan, chargeId) {
  const limits = { free: 50, solo: 450, pro: 2000, premium: 4500 };
  return prisma.subscription.update({
    where: { shop },
    data: {
      plan,
      limitCount: limits[plan] ?? 50,
      chargeId,
      isActive: true,
    },
  });
}
