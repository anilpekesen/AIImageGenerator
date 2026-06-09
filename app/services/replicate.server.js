import Replicate from "replicate";
import { getPhotoSet } from "./photo-sets.js";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

async function removeBackground(imageUrl) {
  const output = await replicate.run(
    "lucataco/remove-bg:95fcc2a26d3899cd6c2691c900465aaeff466285d7090cd62c9e012af4e5d79",
    { input: { image: imageUrl } }
  );
  return typeof output === "string" ? output : output?.toString();
}

async function generateScene(bgRemovedUrl, productTitle, sceneConfig, locale) {
  const prompt = sceneConfig.prompt.replace(/\{product\}/g, productTitle);
  const label = locale === "tr" ? sceneConfig.labelTR : sceneConfig.labelEN;

  const output = await replicate.run(
    "black-forest-labs/flux-dev",
    {
      input: {
        prompt,
        image: bgRemovedUrl,
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
  const bgRemovedUrl = await removeBackground(imageUrl);

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
