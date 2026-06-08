import Backend from "i18next-fs-backend";
import { resolve } from "node:path";
import { RemixI18Next } from "remix-i18next/server";
import i18n from "./i18n";

const i18next = new RemixI18Next({
  detection: {
    supportedLanguages: i18n.supportedLngs,
    fallbackLanguage: i18n.fallbackLng,
    order: ["custom", "searchParams", "cookie", "header"],
    async findLocale(request) {
      // Shopify embeds the admin's locale as ?locale=tr-TR / en-US on every request
      const url = new URL(request.url);
      const locale = url.searchParams.get("locale");
      if (locale) {
        const lang = locale.split("-")[0].toLowerCase();
        if (i18n.supportedLngs.includes(lang)) return lang;
      }
      return null;
    },
  },
  i18next: {
    ...i18n,
    backend: {
      loadPath: resolve("./public/locales/{{lng}}/{{ns}}.json"),
    },
  },
  plugins: [Backend],
});

export default i18next;
