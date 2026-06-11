import { Link, Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { useTranslation } from "react-i18next";
import { authenticate } from "../shopify.server";
import { getOrCreateSubscription } from "../models/subscription.server";
import PlanBar from "../components/PlanBar";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const subscription = await getOrCreateSubscription(session.shop);
  return {
    apiKey: process.env.SHOPIFY_API_KEY || "",
    subscription,
  };
};

export default function App() {
  const { apiKey, subscription } = useLoaderData();
  const { t } = useTranslation();

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      <NavMenu>
        <Link to="/app" rel="home">{t("nav.home")}</Link>
        <Link to="/app/products">{t("nav.products")}</Link>
        <Link to="/app/generate">{t("nav.studio")}</Link>
        <Link to="/app/competition">{t("nav.competition")}</Link>
        <Link to="/app/seo">{t("nav.seo")}</Link>
        <Link to="/app/history">{t("nav.history")}</Link>
        <Link to="/app/billing">{t("nav.billing")}</Link>
      </NavMenu>
      <PlanBar subscription={subscription} />
      <Outlet />
    </AppProvider>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
