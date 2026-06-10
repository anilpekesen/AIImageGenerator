import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { getDoneGenerationsForProduct } from "../models/generation.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  const url = new URL(request.url);
  const productId = url.searchParams.get("productId");
  if (!productId) return json({ images: [] });

  const generations = await getDoneGenerationsForProduct(session.shop, productId);

  const images = [];
  for (const generation of generations) {
    const outputs = JSON.parse(generation.outputs || "[]");
    for (const output of outputs) {
      if (output.url) {
        images.push({
          url: output.url,
          scene: output.scene,
          label: output.label,
          photoSetLabel: generation.photoSetLabel,
          createdAt: generation.createdAt,
        });
      }
    }
  }

  return json({ images });
};
