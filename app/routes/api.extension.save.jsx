import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const CREATE_MEDIA_MUTATION = `
  mutation productCreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
    productCreateMedia(productId: $productId, media: $media) {
      media {
        ... on MediaImage { id image { url } }
      }
      mediaUserErrors { field message }
    }
  }
`;

export const action = async ({ request }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const { admin } = await authenticate.admin(request);
  const body = await request.json();
  const { productId, imageUrls } = body;

  if (!productId || !Array.isArray(imageUrls) || imageUrls.length === 0) {
    return json({ error: "productId ve imageUrls zorunlu" }, { status: 400, headers: corsHeaders });
  }

  try {
    const response = await admin.graphql(CREATE_MEDIA_MUTATION, {
      variables: {
        productId: `gid://shopify/Product/${productId}`,
        media: imageUrls.map((url) => ({
          alt: "AI Generated Photo — Snap6",
          mediaContentType: "IMAGE",
          originalSource: url,
        })),
      },
    });

    const { data } = await response.json();
    const errors = data?.productCreateMedia?.mediaUserErrors || [];
    if (errors.length > 0) {
      return json({ error: errors.map((e) => e.message).join(", ") }, { status: 400, headers: corsHeaders });
    }

    return json({ success: true, saved: imageUrls.length }, { headers: corsHeaders });
  } catch (error) {
    return json({ error: "Kaydetme başarısız: " + error.message }, { status: 500, headers: corsHeaders });
  }
};
