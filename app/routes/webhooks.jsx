import { authenticate } from "../shopify.server";
import { prisma } from "../shopify.server";
import { deleteShopImages } from "../services/storage.server";

export const action = async ({ request }) => {
  const { topic, shop, session, payload } = await authenticate.webhook(request);

  switch (topic) {
    case "APP_UNINSTALLED":
      if (session) {
        await prisma.session.deleteMany({ where: { shop } });
        await prisma.subscription.deleteMany({ where: { shop } });
      }
      break;
    case "CUSTOMERS_DATA_REQUEST":
    case "CUSTOMERS_REDACT":
      // This app stores no end-customer data — only shop-level
      // generation/SEO/competitor records keyed by shop and productId.
      break;
    case "SHOP_REDACT":
      await prisma.session.deleteMany({ where: { shop } });
      await prisma.subscription.deleteMany({ where: { shop } });
      await prisma.generation.deleteMany({ where: { shop } });
      await prisma.seoAudit.deleteMany({ where: { shop } });
      await prisma.competitorAnalysis.deleteMany({ where: { shop } });
      await deleteShopImages(shop).catch((err) =>
        console.error("[webhooks] SHOP_REDACT: failed to delete R2 images:", err.message)
      );
      break;
    default:
      throw new Response("Unknown topic", { status: 404 });
  }

  return new Response("OK", { status: 200 });
};
