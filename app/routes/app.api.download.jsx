import { authenticate } from "../shopify.server";

// Only proxy images from our own R2 bucket and Replicate's output CDN —
// prevents this authenticated endpoint from being used as an open SSRF proxy.
const ALLOWED_HOSTS = [
  new URL(process.env.R2_PUBLIC_URL || "https://invalid.invalid").hostname,
  "replicate.delivery",
];

function isAllowedUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  return ALLOWED_HOSTS.some(
    (host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`)
  );
}

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  const url = new URL(request.url);
  const imageUrl = url.searchParams.get("url");
  const filename = (url.searchParams.get("filename") || "snap6-image.webp").replace(/[^a-zA-Z0-9._-]/g, "_");

  if (!imageUrl) return new Response("Missing url param", { status: 400 });
  if (!isAllowedUrl(imageUrl)) return new Response("URL not allowed", { status: 403 });

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
