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
    const output = await replicate.run(
      "851-labs/background-remover",
      { input: { image: imageInput } }
    );
    return typeof output === "string" ? output : output?.toString();
  } catch {
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
        prompt_strength: 0.75,
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

export async function startGeneration({ imageUrl, productTitle, photoSetId = "general", locale = "tr" }) {
  const photoSet = getPhotoSet(photoSetId);
  const imageInput = toImageInput(imageUrl);
  const bgRemovedUrl = await removeBackground(imageInput);

  const results = await Promise.all(
    photoSet.scenes.map((sceneConfig) =>
      generateScene(bgRemovedUrl, productTitle, sceneConfig, locale).catch((err) => ({
        url: null,
        scene: sceneConfig.scene,
        label: locale === "tr" ? sceneConfig.labelTR : sceneConfig.labelEN,
        error: err.message,
      }))
    )
  );

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
