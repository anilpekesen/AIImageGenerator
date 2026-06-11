import { createCookie } from "@remix-run/node";

// Stores a merchant's manual language override so it can win over Shopify's
// `?locale=` admin-locale param. Embedded apps run inside a cross-site
// iframe, so the cookie needs SameSite=None + Secure (+ Partitioned/CHIPS)
// to survive in modern browsers.
export const localeCookie = createCookie("app_locale", {
  path: "/",
  sameSite: "none",
  secure: true,
  partitioned: true,
  maxAge: 60 * 60 * 24 * 365,
});
