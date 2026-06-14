import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

import i18next from "../i18next.server";
import BlogPost from "../components/marketing/BlogPost";
import { getBlogPost } from "../content/blog-posts";
import marketingStyles from "../styles/marketing.css?url";

export const links = () => [{ rel: "stylesheet", href: marketingStyles }];

export const meta = ({ data }) => {
  if (!data) return [];
  return [
    { title: data.metaTitle },
    { name: "description", content: data.metaDescription },
  ];
};

export const loader = async ({ request, params }) => {
  const post = getBlogPost(params.slug);
  if (!post) {
    throw new Response("Not Found", { status: 404 });
  }

  const locale = await i18next.getLocale(request);
  const lang = locale?.startsWith("en") ? "en" : "tr";
  const content = post[lang];

  return json({
    post,
    metaTitle: content.metaTitle,
    metaDescription: content.metaDescription,
  });
};

export default function BlogPostRoute() {
  const { post } = useLoaderData();
  return <BlogPost post={post} />;
}
