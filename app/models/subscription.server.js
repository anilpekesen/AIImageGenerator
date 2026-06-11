import { prisma } from "../shopify.server";

export const CREDIT_COSTS = {
  PHOTO_SET: 6,
  REFINE: 1,
  SEO_AUDIT: 1,
  COMPETITOR_ANALYSIS: 3,
};

export const PLAN_CREDIT_LIMITS = {
  free: 50,
  solo: 450,
  pro: 2000,
  premium: 4500,
};

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

  const expectedLimit = PLAN_CREDIT_LIMITS[subscription.plan];
  if (expectedLimit && subscription.limitCount !== expectedLimit) {
    subscription = await prisma.subscription.update({
      where: { shop },
      data: { limitCount: expectedLimit },
    });
  }

  return subscription;
}

export async function consumeCredits(shop, credits) {
  if (!Number.isInteger(credits) || credits <= 0) {
    throw new Error("credits must be a positive integer");
  }

  const subscription = await getOrCreateSubscription(shop);
  const result = await prisma.subscription.updateMany({
    where: {
      shop,
      usedCount: { lte: subscription.limitCount - credits },
    },
    data: { usedCount: { increment: credits } },
  });

  return result.count === 1;
}

export async function refundCredits(shop, credits) {
  if (!Number.isInteger(credits) || credits <= 0) return;

  await prisma.$executeRaw`
    UPDATE "Subscription"
    SET
      "usedCount" = CASE
        WHEN "usedCount" >= ${credits} THEN "usedCount" - ${credits}
        ELSE 0
      END,
      "updatedAt" = ${new Date()}
    WHERE "shop" = ${shop}
  `;
}

export async function upgradePlan(shop, plan, chargeId) {
  return prisma.subscription.update({
    where: { shop },
    data: {
      plan,
      limitCount: PLAN_CREDIT_LIMITS[plan] ?? PLAN_CREDIT_LIMITS.free,
      chargeId,
      isActive: true,
    },
  });
}

export async function cancelSubscriptionPlan(shop) {
  return prisma.subscription.update({
    where: { shop },
    data: {
      plan: "free",
      limitCount: PLAN_CREDIT_LIMITS.free,
      chargeId: null,
      isActive: true,
    },
  });
}
