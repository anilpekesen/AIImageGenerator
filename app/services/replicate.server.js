import Replicate from "replicate";
import { getPhotoSet } from "./photo-sets.js";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

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

async function generateScene(imageInput, productTitle, sceneConfig, locale) {
  const prompt = sceneConfig.prompt.replace(/\{product\}/g, productTitle);
  const label = locale === "tr" ? sceneConfig.labelTR : sceneConfig.labelEN;

  const output = await replicate.run(
    "black-forest-labs/flux-dev",
    {
      input: {
        prompt,
        image: imageInput,
        prompt_strength: 0.60,
        num_inference_steps: 28,
        guidance: 3.5,
        width: 1024,
        height: 1024,
        output_format: "webp",
        output_quality: 90,
      },
    }
  );

  const url = Array.isArray(output) ? output[0] : output;
  return { url: url?.toString(), scene: sceneConfig.scene, label };
}

async function generateSceneWithRetry(imageInput, productTitle, sceneConfig, locale, maxRetries = 2) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await generateScene(imageInput, productTitle, sceneConfig, locale);
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

export async function startGeneration({ imageUrl, productTitle, photoSetId = "general", locale = "tr" }) {
  const photoSet = getPhotoSet(photoSetId);
  const imageInput = toImageInput(imageUrl);
  const bgRemovedUrl = await removeBackground(imageInput);

  const results = [];
  for (const sceneConfig of photoSet.scenes) {
    const result = await generateSceneWithRetry(bgRemovedUrl, productTitle, sceneConfig, locale).catch((err) => {
      console.error(`[replicate] scene "${sceneConfig.scene}" failed:`, err.message);
      return {
        url: null,
        scene: sceneConfig.scene,
        label: locale === "tr" ? sceneConfig.labelTR : sceneConfig.labelEN,
        error: err.message,
      };
    });
    results.push(result);
  }

  return results;
}

export async function refineScene({ imageUrl, refinementPrompt }) {
  const output = await replicate.run("black-forest-labs/flux-dev", {
    input: {
      prompt: refinementPrompt,
      image: imageUrl,
      prompt_strength: 0.5,
      num_inference_steps: 28,
      guidance: 3.5,
      width: 1024,
      height: 1024,
      output_format: "webp",
      output_quality: 90,
    },
  });
  const url = Array.isArray(output) ? output[0] : output;
  return url?.toString();
}
