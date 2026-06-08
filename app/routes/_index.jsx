import { redirect } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import { useTranslation } from "react-i18next";

import { login } from "../shopify.server";

export const loader = async ({ request }) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function Index() {
  const { showForm } = useLoaderData();
  const { t } = useTranslation();

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
