import { json } from "@remix-run/node";

import i18next from "../i18next.server";
import LegalPage from "../components/marketing/LegalPage";
import marketingStyles from "../styles/marketing.css?url";

export const links = () => [{ rel: "stylesheet", href: marketingStyles }];

export const meta = ({ data }) => [
  { title: data.metaTitle },
  { name: "description", content: data.metaDescription },
];

export const loader = async ({ request }) => {
  const t = await i18next.getFixedT(request);
  return json({
    metaTitle: t("legal.privacy.metaTitle"),
    metaDescription: t("legal.privacy.metaDescription"),
  });
};

export default function PrivacyPolicy() {
  return <LegalPage docKey="privacy" />;
}
