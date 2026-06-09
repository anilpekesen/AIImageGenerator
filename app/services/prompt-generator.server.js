import Anthropic from "@anthropic-ai/sdk";
import { detectCategory, getTemplateById } from "./photo-set-templates.js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function buildImageContent(imageUrl) {
  if (typeof imageUrl === "string" && imageUrl.startsWith("data:")) {
    const match = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      return { type: "image", source: { type: "base64", media_type: match[1], data: match[2] } };
    }
  }
  return { type: "image", source: { type: "url", url: imageUrl } };
}

export async function generateScenePrompts(imageUrl, productTitle, options = {}) {
  const product = options.product || { title: productTitle };
  const categoryId = options.photoSetId || detectCategory(product);
  const template = getTemplateById(categoryId);

  console.log(`[prompt-generator] category: "${categoryId}" for product: "${productTitle}"`);

  const imageContent = buildImageContent(imageUrl);

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2500,
    system: template.systemPrompt,
    messages: [
      {
        role: "user",
        content: [
          imageContent,
          {
            type: "text",
            text: `Product: "${productTitle}"\nProduct type: "${product.productType || ""}"\nTags: "${Array.isArray(product.tags) ? product.tags.join(", ") : product.tags || ""}"\n\nAnalyze this product image carefully and generate 6 professional photography scene prompts following the selected "${template.labelEN}" template. Return JSON array only.`,
          },
        ],
      },
    ],
  });

  const text = response.content[0]?.text?.trim() ?? "";
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.error("[prompt-generator] unexpected Claude response:", text.slice(0, 200));
    throw new Error("Claude did not return valid JSON array");
  }

  const scenes = JSON.parse(jsonMatch[0]);
  if (!Array.isArray(scenes) || scenes.length === 0) {
    throw new Error("Claude returned empty scenes array");
  }

  console.log(`[prompt-generator] generated ${scenes.length} scenes`);
  return scenes.map((scene) => ({
    ...scene,
    photoSetId: template.id,
    photoSetLabelTR: template.labelTR,
    photoSetLabelEN: template.labelEN,
  }));
}

export const FALLBACK_SCENES = [
  {
    scene: "studio-white",
    labelTR: "Stüdyo Beyaz",
    labelEN: "Studio White",
    prompt: "product preserved in exact original design, color, and proportions. Pure white seamless background, soft even box studio lighting from both sides, centered product display, no shadows on background. Photorealistic, ultra-detailed, editorial photography, cinematic color grading, premium commercial quality.",
  },
  {
    scene: "lifestyle",
    labelTR: "Yaşam Tarzı",
    labelEN: "Lifestyle",
    prompt: "product preserved in exact original design, color, and proportions. Clean minimalist modern interior, natural window light from the side, warm morning atmosphere, soft blurred background. Photorealistic, ultra-detailed, editorial photography, cinematic color grading, premium commercial quality.",
  },
  {
    scene: "detail-closeup",
    labelTR: "Detay Yakın",
    labelEN: "Detail Closeup",
    prompt: "product preserved in exact original design, color, and proportions. Extreme macro close-up showing material texture and surface quality, sharp focus, soft diffused studio side lighting, white background, shallow depth of field. Photorealistic, ultra-detailed, editorial photography, cinematic color grading, premium commercial quality.",
  },
  {
    scene: "in-use",
    labelTR: "Kullanım Sahnesi",
    labelEN: "In-use Scene",
    prompt: "product preserved in exact original design, color, and proportions. Natural lifestyle context with appropriate human presence (partial — no face), warm natural daylight, authentic atmosphere. Photorealistic, ultra-detailed, editorial photography, cinematic color grading, premium commercial quality.",
  },
  {
    scene: "flat-lay",
    labelTR: "Flat Lay",
    labelEN: "Flat Lay",
    prompt: "product preserved in exact original design, color, and proportions. Overhead flat lay on clean white surface, top-down composition, soft natural window light, minimal e-commerce photography. Photorealistic, ultra-detailed, editorial photography, cinematic color grading, premium commercial quality.",
  },
  {
    scene: "editorial",
    labelTR: "Dramatik Editöryal",
    labelEN: "Dramatic Editorial",
    prompt: "product preserved in exact original design, color, and proportions. Dark moody studio setting, single hard spotlight from above-left, deep shadows, rim light outlining form, tight to medium frame, rich black and charcoal palette, luxurious cinematic mood. Photorealistic, ultra-detailed, editorial photography, cinematic color grading, premium commercial quality.",
  },
];
