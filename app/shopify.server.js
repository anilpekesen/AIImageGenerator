import "dotenv/config";
import "@shopify/shopify-app-remix/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
  BillingInterval,
} from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Credits: 1 set=6cr, 1 refine=1cr, 1 SEO=1cr, 1 competitor=3cr
export const PLANS = {
  FREE: {
    name: "Free",
    limit: 50,
    price: 0,
  },
  SOLO: {
    name: "Solo",
    limit: 450,
    price: 29.99,
    shopifyPlanName: "Solo - 450 Credits/mo",
  },
  PRO: {
    name: "Pro",
    limit: 2000,
    price: 129.99,
    shopifyPlanName: "Pro - 2000 Credits/mo",
  },
  PREMIUM: {
    name: "Premium",
    limit: 4500,
    price: 299.99,
    shopifyPlanName: "Premium - 4500 Credits/mo",
  },
};

const DISTRIBUTIONS = {
  app_store: AppDistribution.AppStore,
  single_merchant: AppDistribution.SingleMerchant,
  shopify_admin: AppDistribution.ShopifyAdmin,
};

const appDistribution =
  DISTRIBUTIONS[process.env.SHOPIFY_APP_DISTRIBUTION] ||
  AppDistribution.SingleMerchant;

const useTokenExchange = process.env.SHOPIFY_USE_TOKEN_EXCHANGE === "true";

const billingConfig = {
  [PLANS.SOLO.shopifyPlanName]: {
    lineItems: [{
      amount: PLANS.SOLO.price,
      currencyCode: "USD",
      interval: BillingInterval.Every30Days,
    }],
  },
  [PLANS.PRO.shopifyPlanName]: {
    lineItems: [{
      amount: PLANS.PRO.price,
      currencyCode: "USD",
      interval: BillingInterval.Every30Days,
    }],
  },
  [PLANS.PREMIUM.shopifyPlanName]: {
    lineItems: [{
      amount: PLANS.PREMIUM.price,
      currencyCode: "USD",
      interval: BillingInterval.Every30Days,
    }],
  },
};

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.October25,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: appDistribution,
  ...(appDistribution === AppDistribution.AppStore ? { billing: billingConfig } : {}),
  future: {
    unstable_newEmbeddedAuthStrategy: useTokenExchange,
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.October25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
export { prisma };
