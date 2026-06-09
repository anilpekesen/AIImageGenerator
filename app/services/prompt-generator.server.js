import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are an expert commercial photography director and creative strategist.

Analyze the product image and generate exactly 6 distinct editorial photography scene concepts for AI image generation (Flux Dev img2img).

The product in the input image will be preserved via img2img conditioning — your prompts set the SCENE, ENVIRONMENT, LIGHTING, and AESTHETIC around the product.

GENERATE EXACTLY THESE 6 SCENE TYPES (in order):
1. Studio White — clean seamless background, professional e-commerce, catalog quality
2. Lifestyle Context — environment that is natural and fitting for THIS specific product type
3. Detail Shot — extreme close-up of material texture, craftsmanship, surface quality
4. Narrative Editorial — unexpected location with thematic tension and storytelling weight
5. Minimalist Architectural — negative space, clean lines, art direction
6. Dramatic Cinematic — bold lighting, moody atmosphere, premium editorial

For EACH scene, construct a single detailed prompt string following this structure:
"[product type] displayed in [scene], preserved in all original details. [Location: specific architectural/environmental details, materials, textures, atmosphere]. [Human presence: none / hands only / partial torso / full model — only if relevant for product type]. [Lighting: type + temperature + mood]. [Composition: framing + camera angle + depth]. [Mood & palette: 2-3 harmonized colors max, color grading style]. Photorealistic, ultra-detailed, editorial photography, cinematic color grading, premium commercial quality."

CRITICAL RULES:
- Vary scene type, location, human presence, lighting, and mood across all 6 — no two scenes should feel similar
- Match lifestyle and human presence to the product type (underwear: bedroom/model appropriate; hat: outdoor; furniture: interior; etc.)
- Prompts must be rich, specific, and descriptive — generic prompts produce generic images
- Return ONLY a valid JSON array, no other text, no markdown fences

OUTPUT FORMAT (JSON array of exactly 6 objects):
[
  {
    "scene": "kebab-case-id",
    "labelTR": "Türkçe Etiket (2-4 kelime)",
    "labelEN": "English Label (2-4 words)",
    "prompt": "Full detailed scene prompt in English."
  }
]`;

function buildImageContent(imageUrl) {
  if (typeof imageUrl === "string" && imageUrl.startsWith("data:")) {
    const match = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      return { type: "image", source: { type: "base64", media_type: match[1], data: match[2] } };
    }
  }
  return { type: "image", source: { type: "url", url: imageUrl } };
}

export async function generateScenePrompts(imageUrl, productTitle) {
  const imageContent = buildImageContent(imageUrl);

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2500,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          imageContent,
          {
            type: "text",
            text: `Product name: "${productTitle}"\n\nAnalyze this product image and generate 6 editorial scene prompts as specified. Return JSON only.`,
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

  console.log("[prompt-generator] generated", scenes.length, "scenes for:", productTitle);
  return scenes;
}

export const FALLBACK_SCENES = [
  {
    scene: "studio-white",
    labelTR: "Stüdyo Beyaz",
    labelEN: "Studio White",
    prompt: "product displayed on pure white seamless background, preserved in all details. Soft even box studio lighting from both sides, no shadows. Centered composition, front-facing view. Crisp white palette, clean e-commerce catalog quality. Photorealistic, ultra-detailed, editorial photography, cinematic color grading, premium commercial quality.",
  },
  {
    scene: "lifestyle",
    labelTR: "Yaşam Tarzı",
    labelEN: "Lifestyle",
    prompt: "product displayed in a clean minimalist modern interior, preserved in all details. Natural window light from the side, warm morning atmosphere. Medium frame, slightly off-center. Warm neutral palette of cream and light wood. Photorealistic, ultra-detailed, editorial photography, cinematic color grading, premium commercial quality.",
  },
  {
    scene: "detail-closeup",
    labelTR: "Detay Yakın",
    labelEN: "Detail Closeup",
    prompt: "product displayed in extreme macro close-up showing material texture and surface quality, preserved in all details. Soft diffused studio side lighting. Tight crop, shallow depth of field. Neutral white-gray palette. Photorealistic, ultra-detailed, editorial photography, cinematic color grading, premium commercial quality.",
  },
  {
    scene: "narrative-editorial",
    labelTR: "Editöryal Anlatı",
    labelEN: "Narrative Editorial",
    prompt: "product displayed in a brutalist concrete interior setting, preserved in all details. Hard directional side light, cool temperature, sculptural shadows. Medium frame, off-center composition with negative space. Cool grey and graphite palette, tense cinematic mood. Photorealistic, ultra-detailed, editorial photography, cinematic color grading, premium commercial quality.",
  },
  {
    scene: "minimalist-architectural",
    labelTR: "Minimalist",
    labelEN: "Minimalist",
    prompt: "product displayed in a minimalist architectural setting with clean white walls and geometric lines, preserved in all details. Soft diffused natural light. Wide environmental shot, centered symmetry, strong negative space. Pale white and warm grey palette, quiet elegance. Photorealistic, ultra-detailed, editorial photography, cinematic color grading, premium commercial quality.",
  },
  {
    scene: "dramatic-cinematic",
    labelTR: "Dramatik Sinematik",
    labelEN: "Dramatic Cinematic",
    prompt: "product displayed in a dark moody studio setting, preserved in all details. Single hard spotlight from above-left, deep shadows, rim light outlining form. Tight to medium frame, low camera angle. Rich black, charcoal and muted gold palette, luxurious cinematic mood. Photorealistic, ultra-detailed, editorial photography, cinematic color grading, premium commercial quality.",
  },
];
