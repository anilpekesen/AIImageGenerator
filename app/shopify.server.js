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

export const PLANS = {
  FREE: {
    name: "Free",
    limit: 5,
    price: 0,
  },
  STARTER: {
    name: "Starter",
    limit: 30,
    price: 14.99,
    shopifyPlanName: "Starter - 30 Generations/mo",
  },
  PROFESSIONAL: {
    name: "Professional",
    limit: 100,
    price: 39.99,
    shopifyPlanName: "Professional - 100 Generations/mo",
  },
  BUSINESS: {
    name: "Business",
    limit: 300,
    price: 99.99,
    shopifyPlanName: "Business - 300 Generations/mo",
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
  distribution: AppDistribution.AppStore,
  billing: {
    [PLANS.STARTER.shopifyPlanName]: {
      lineItems: [
        {
          amount: PLANS.STARTER.price,
          currencyCode: "USD",
          interval: BillingInterval.Every30Days,
        },
      ],
    },
    [PLANS.PROFESSIONAL.shopifyPlanName]: {
      lineItems: [
        {
          amount: PLANS.PROFESSIONAL.price,
          currencyCode: "USD",
          interval: BillingInterval.Every30Days,
        },
      ],
    },
    [PLANS.BUSINESS.shopifyPlanName]: {
      lineItems: [
        {
          amount: PLANS.BUSINESS.price,
          currencyCode: "USD",
          interval: BillingInterval.Every30Days,
        },
      ],
    },
  },
  future: {
    unstable_newEmbeddedAuthStrategy: true,
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
