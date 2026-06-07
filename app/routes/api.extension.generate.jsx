import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { startGeneration } from "../services/replicate.server";
import { createGeneration, updateGeneration } from "../models/generation.server";
import { getOrCreateSubscription, decrementUsage } from "../models/subscription.server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const options = async () => new Response(null, { headers: corsHeaders });

export const action = async ({ request }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const { session } = await authenticate.admin(request);
  const { shop } = session;
  const body = await request.json();
  const { productId, productTitle, imageUrl } = body;

  if (!productId || !imageUrl) {
    return json({ error: "productId ve imageUrl zorunlu" }, { status: 400, headers: corsHeaders });
  }

  const subscription = await getOrCreateSubscription(shop);
  if (subscription.usedCount >= subscription.limitCount) {
    return json(
      { error: "Aylık üretim limitiniz doldu. Lütfen planınızı yükseltin." },
      { status: 400, headers: corsHeaders }
    );
  }

  const generation = await createGeneration({
    shop,
    productId,
    productTitle: productTitle || "Ürün",
    inputImage: imageUrl,
  });

  try {
    const outputs = await startGeneration({ imageUrl, productTitle: productTitle || "ürün" });

    await updateGeneration(generation.id, {
      outputs: JSON.stringify(outputs),
      status: "done",
    });
    await decrementUsage(shop);

    return json({ success: true, outputs }, { headers: corsHeaders });
  } catch (error) {
    await updateGeneration(generation.id, { status: "failed" });
    return json({ error: "Üretim başarısız: " + error.message }, { status: 500, headers: corsHeaders });
  }
};
