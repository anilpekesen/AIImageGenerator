import { json } from "@remix-run/node";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from "@remix-run/react";
import { useChangeLanguage } from "remix-i18next/react";
import { useTranslation } from "react-i18next";
import i18next from "./i18next.server";

const MARKETING_HOSTS = ["rankavio.com", "www.rankavio.com"];

export const loader = async ({ request }) => {
  const host = (request.headers.get("host") || "").split(":")[0].toLowerCase();
  const locale = await i18next.getLocale(request);
  return json({
    locale,
    apiKey: process.env.SHOPIFY_API_KEY || "",
    isMarketingHost: MARKETING_HOSTS.includes(host),
  });
};

export const handle = {
  i18n: ["translation"],
};

export default function App() {
  const { locale, apiKey, isMarketingHost } = useLoaderData();
  const { i18n } = useTranslation();
  useChangeLanguage(locale);

  return (
    <html lang={locale} dir={i18n.dir()}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        {isMarketingHost ? (
          <>
            <link rel="icon" type="image/svg+xml" href="/images/logo/rankavio-icon.svg" />
            <script async src="https://www.googletagmanager.com/gtag/js?id=G-BW8FN5HVNT"></script>
            <script
              dangerouslySetInnerHTML={{
                __html: `
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', 'G-BW8FN5HVNT');
                `,
              }}
            />
          </>
        ) : (
          <>
            <link rel="preconnect" href="https://cdn.shopify.com/" />
            <link
              rel="stylesheet"
              href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css"
            />
            <meta name="shopify-api-key" content={apiKey} />
            <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>
          </>
        )}
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
