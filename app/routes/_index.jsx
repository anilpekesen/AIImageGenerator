import { json, redirect } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import { useTranslation } from "react-i18next";

import { login } from "../shopify.server";
import i18next from "../i18next.server";
import MarketingHome from "../components/marketing/MarketingHome";
import marketingStyles from "../styles/marketing.css?url";

const MARKETING_HOSTS = ["rankavio.com", "www.rankavio.com"];

export const links = () => [{ rel: "stylesheet", href: marketingStyles }];

export const meta = ({ data }) => {
  if (data?.isMarketing) {
    return [
      { title: data.metaTitle },
      { name: "description", content: data.metaDescription },
    ];
  }
  return [];
};

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const host = (request.headers.get("host") || "").split(":")[0].toLowerCase();

  if (MARKETING_HOSTS.includes(host)) {
    const t = await i18next.getFixedT(request);
    return json({
      isMarketing: true,
      metaTitle: t("marketing.meta.title"),
      metaDescription: t("marketing.meta.description"),
    });
  }

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return json({ isMarketing: false, showForm: Boolean(login) });
};

export default function Index() {
  const data = useLoaderData();
  const { t } = useTranslation();

  if (data.isMarketing) {
    return <MarketingHome />;
  }

  const { showForm } = data;

  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "80px 20px" }}>
      <div style={{ maxWidth: "440px", textAlign: "center" }}>
        <h1>{t("landing.title")}</h1>
        <p>{t("landing.subtitle")}</p>
        {showForm && (
          <Form method="get" action="/auth" style={{ marginTop: "24px" }}>
            <label>
              <span>{t("landing.shopLabel")}</span>
              <input type="text" name="shop" placeholder="my-shop-domain.myshopify.com" />
            </label>
            <button type="submit">{t("landing.loginButton")}</button>
          </Form>
        )}
      </div>
    </div>
  );
}
