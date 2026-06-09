import Replicate from "replicate";
import { generateScenePrompts, FALLBACK_SCENES } from "./prompt-generator.server.js";

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

function dataUrlToBuffer(dataUrl) {
  const match = dataUrl.match(/^data:[^;]+;base64,(.+)$/);
  if (!match) return null;
  return Buffer.from(match[1], "base64");
}

function toImageInput(imageUrl) {
  if (typeof imageUrl === "string" && imageUrl.startsWith("data:")) {
    return dataUrlToBuffer(imageUrl) ?? imageUrl;
  }
  return imageUrl;
}

async function removeBackground(imageInput) {
  try {
    const model = await replicate.models.get("cjwbw", "rembg");
    const version = model.latest_version?.id;
    if (!version) throw new Error("No version found for cjwbw/rembg");
    const output = await replicate.run(`cjwbw/rembg:${version}`, { input: { image: imageInput } });
    const result = typeof output === "string" ? output : output?.toString();
    console.log("[replicate] bg removed:", result?.slice(0, 80));
    return result;
  } catch (err) {
    console.error("[replicate] bg removal failed, using original:", err.message);
    return imageInput;
  }
}

async function generateScene(imageInput, sceneConfig, locale) {
  const label = locale === "tr" ? sceneConfig.labelTR : sceneConfig.labelEN;
  const aspectRatio = sceneConfig.aspectRatio || "1:1";

  const output = await replicate.run("black-forest-labs/flux-kontext-pro", {
    input: {
      prompt: sceneConfig.prompt,
      input_image: imageInput,
      aspect_ratio: aspectRatio,
      output_format: "webp",
      output_quality: 90,
      safety_tolerance: 2,
      prompt_upsampling: false,
    },
  });

  const url = Array.isArray(output) ? output[0] : output;
  return { url: url?.toString(), scene: sceneConfig.scene, label, aspectRatio };
}

async function generateSceneWithRetry(imageInput, sceneConfig, locale, maxRetries = 2) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await generateScene(imageInput, sceneConfig, locale);
    } catch (err) {
      const retryAfterMatch = err.message?.match(/"retry_after":(\d+)/);
      const is429 = err.message?.includes("429");
      if (is429 && attempt < maxRetries) {
        const wait = ((retryAfterMatch ? parseInt(retryAfterMatch[1]) : 10) + 2) * 1000;
        console.log(`[replicate] 429 on "${sceneConfig.scene}", retry ${attempt + 1} in ${wait / 1000}s`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      throw err;
    }
  }
}

export async function startGeneration({ imageUrl, productTitle, locale = "tr", photoSetId, product }) {
  const imageInput = toImageInput(imageUrl);

  let scenes;
  try {
    scenes = await generateScenePrompts(imageUrl, productTitle, { photoSetId, product });
  } catch (err) {
    console.error("[prompt-generator] failed, using fallback scenes:", err.message);
    scenes = FALLBACK_SCENES;
  }

  const bgRemovedUrl = await removeBackground(imageInput);
  const results = [];

  for (const sceneConfig of scenes) {
    const result = await generateSceneWithRetry(bgRemovedUrl, sceneConfig, locale).catch((err) => {
      console.error(`[replicate] scene "${sceneConfig.scene}" failed:`, err.message);
      return {
        url: null,
        scene: sceneConfig.scene,
        label: locale === "tr" ? sceneConfig.labelTR : sceneConfig.labelEN,
        aspectRatio: sceneConfig.aspectRatio || "1:1",
        error: err.message,
      };
    });
    results.push(result);
  }

  return results;
}

export async function refineScene({ imageUrl, refinementPrompt, sceneLabel, photoSetLabel }) {
  const contextualPrompt = [
    refinementPrompt,
    sceneLabel ? `Keep this as the same "${sceneLabel}" shot type.` : "",
    photoSetLabel ? `Maintain the visual language of the "${photoSetLabel}" photo set.` : "",
    "Preserve the exact original product in full detail. Do not change product design, color, material, proportions, or key features. Photorealistic, professional commercial photography quality.",
  ]
    .filter(Boolean)
    .join(" ");

  const output = await replicate.run("black-forest-labs/flux-kontext-pro", {
    input: {
      prompt: contextualPrompt,
      input_image: imageUrl,
      aspect_ratio: "1:1",
      output_format: "webp",
      output_quality: 90,
      safety_tolerance: 2,
      prompt_upsampling: false,
    },
  });
  const url = Array.isArray(output) ? output[0] : output;
  return url?.toString();
}
