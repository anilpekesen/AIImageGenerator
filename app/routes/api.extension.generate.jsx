import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { startGeneration } from "../services/replicate.server";
import { createGeneration, updateGeneration } from "../models/generation.server";
import {
  CREDIT_COSTS,
  consumeCredits,
  refundCredits,
} from "../models/subscription.server";

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
  const { productId, productTitle, imageUrl, photoSetId } = body;

  if (!productId || !imageUrl) {
    return json({ error: "productId ve imageUrl zorunlu" }, { status: 400, headers: corsHeaders });
  }

  const creditsReserved = await consumeCredits(shop, CREDIT_COSTS.PHOTO_SET);
  if (!creditsReserved) {
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
    const outputs = await startGeneration({ imageUrl, productTitle: productTitle || "ürün", photoSetId: photoSetId || "general" });

    await updateGeneration(generation.id, {
      outputs: JSON.stringify(outputs),
      status: "done",
    });
    const successCount = outputs.filter((o) => o.url).length;
    await refundCredits(shop, CREDIT_COSTS.PHOTO_SET - successCount);

    return json({ success: true, outputs }, { headers: corsHeaders });
  } catch (error) {
    await refundCredits(shop, CREDIT_COSTS.PHOTO_SET);
    await updateGeneration(generation.id, { status: "failed" });
    return json({ error: "Üretim başarısız: " + error.message }, { status: 500, headers: corsHeaders });
  }
};
