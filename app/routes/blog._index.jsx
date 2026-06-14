import { json } from "@remix-run/node";

import i18next from "../i18next.server";
import BlogIndex from "../components/marketing/BlogIndex";
import marketingStyles from "../styles/marketing.css?url";

export const links = () => [{ rel: "stylesheet", href: marketingStyles }];

export const meta = ({ data }) => [
  { title: data.metaTitle },
  { name: "description", content: data.metaDescription },
];

export const loader = async ({ request }) => {
  const t = await i18next.getFixedT(request);
  return json({
    metaTitle: `${t("blog.index.heading")} | Rankavio`,
    metaDescription: t("blog.index.subheading"),
  });
};

export default function Blog() {
  return <BlogIndex />;
}
