import Replicate from "replicate";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

const SCENE_PROMPTS = [
  {
    scene: "studio",
    label: "Studio Beyaz",
    prompt: "professional product photo of {product} on pure white background, soft box studio lighting, clean e-commerce photography, high resolution",
  },
  {
    scene: "lifestyle-indoor",
    label: "Lifestyle İç Mekan",
    prompt: "{product} in a modern minimalist living room, natural window light, lifestyle photography, shallow depth of field, warm tones",
  },
  {
    scene: "outdoor",
    label: "Dış Mekan",
    prompt: "{product} outdoors in a beautiful lush garden, golden hour sunlight, lifestyle photography, bokeh background",
  },
  {
    scene: "marble-luxury",
    label: "Mermer / Lüks",
    prompt: "{product} on elegant white marble surface, luxury brand aesthetic, professional studio lighting, high-end commercial photography",
  },
  {
    scene: "dark-moody",
    label: "Dramatik Koyu",
    prompt: "{product} on dark matte background, dramatic side lighting, moody commercial photography, professional studio shot",
  },
  {
    scene: "flat-lay",
    label: "Flat Lay",
    prompt: "overhead flat lay photo of {product}, styled minimalist composition, editorial photography, clean background, top view",
  },
];

async function removeBackground(imageUrl) {
  const output = await replicate.run(
    "lucataco/remove-bg:95fcc2a26d3899cd6c2691c900465aaeff466285d7090cd62c9e012af4e5d79",
    { input: { image: imageUrl } }
  );
  return typeof output === "string" ? output : output?.toString();
}

async function generateScene(bgRemovedUrl, productTitle, sceneConfig) {
  const prompt = sceneConfig.prompt.replace(/\{product\}/g, productTitle);

  const output = await replicate.run(
    "black-forest-labs/flux-1.1-pro",
    {
      input: {
        prompt,
        image: bgRemovedUrl,
        prompt_strength: 0.75,
        num_inference_steps: 25,
        guidance_scale: 3.5,
        width: 1024,
        height: 1024,
        output_format: "webp",
        output_quality: 90,
      },
    }
  );

  const url = Array.isArray(output) ? output[0] : output;
  return { url: url?.toString(), scene: sceneConfig.scene, label: sceneConfig.label };
}

export async function startGeneration({ imageUrl, productTitle }) {
  const bgRemovedUrl = await removeBackground(imageUrl);

  const results = await Promise.all(
    SCENE_PROMPTS.map((sceneConfig) =>
      generateScene(bgRemovedUrl, productTitle, sceneConfig).catch((err) => ({
        url: null,
        scene: sceneConfig.scene,
        label: sceneConfig.label,
        error: err.message,
      }))
    )
  );

  return results;
}
