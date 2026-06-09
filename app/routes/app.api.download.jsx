import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  const url = new URL(request.url);
  const imageUrl = url.searchParams.get("url");
  const filename = url.searchParams.get("filename") || "snap6-image.webp";

  if (!imageUrl) return new Response("Missing url param", { status: 400 });

  const upstream = await fetch(imageUrl);
  if (!upstream.ok) return new Response("Failed to fetch image", { status: 502 });

  const buffer = await upstream.arrayBuffer();
  const contentType = upstream.headers.get("content-type") || "image/webp";

  return new Response(buffer, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
};
