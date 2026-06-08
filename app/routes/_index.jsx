import { redirect } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";

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

  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "80px 20px" }}>
      <div style={{ maxWidth: "440px", textAlign: "center" }}>
        <h1>Snap6 — AI Photo Studio</h1>
        <p>Bir fotoğraf yükleyin, tek tıkla 6 profesyonel ürün sahnesi alın.</p>
        {showForm && (
          <Form method="get" action="/auth" style={{ marginTop: "24px" }}>
            <label>
              <span>Mağaza adresi</span>
              <input type="text" name="shop" placeholder="my-shop-domain.myshopify.com" />
            </label>
            <button type="submit">Giriş yap</button>
          </Form>
        )}
      </div>
    </div>
  );
}
