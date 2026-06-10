import { PHOTO_SET_TEMPLATES } from "./photo-set-templates.js";

const EXAMPLE_IMAGES = {
  general: "/images/photo-sets/genel.png",
  "sofa-set": "/images/photo-sets/koltuk-takimi.png",
  armchair: "/images/photo-sets/koltuk-berjer.png",
  "dining-set": "/images/photo-sets/yemek-masasi.png",
  chair: "/images/photo-sets/sandalye.png",
  "bed-frame": "/images/photo-sets/karyola.png",
  "office-furniture": "/images/photo-sets/ofis-mobilyasi.png",
  "floor-cushion": "/images/photo-sets/minder.png",
  "throw-pillow": "/images/photo-sets/kirlent.png",
  curtain: "/images/photo-sets/perde.png",
  tablecloth: "/images/photo-sets/masa-ortusu.png",
  blanket: "/images/photo-sets/battaniye.png",
  bedspread: "/images/photo-sets/yatak-ortusu.png",
  "baby-clothing": "/images/photo-sets/bebek-kiyafeti.png",
  jewelry: "/images/photo-sets/taki.png",
  bag: "/images/photo-sets/canta.png",
  underwear: "/images/photo-sets/ic-giyim.png",
  clothing: "/images/photo-sets/giyim.png",
  hat: "/images/photo-sets/sapka.png",
};

function sceneIdFromTitle(title) {
  return title
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function extractScenes(systemPrompt) {
  const scenes = [];
  const shotPattern = /SHOT\s+\d+\s+—\s+([^(:\n]+)(?:\s+\(([^)]+)\))?/g;
  let match;

  while ((match = shotPattern.exec(systemPrompt)) && scenes.length < 6) {
    const title = match[1].trim();
    const aspectRatio = match[2]?.trim() || "";
    scenes.push({
      scene: sceneIdFromTitle(title),
      labelTR: title,
      labelEN: title,
      aspectRatio,
    });
  }

  return scenes;
}

export const PHOTO_SETS = PHOTO_SET_TEMPLATES.map((template) => ({
  id: template.id,
  exampleImage: EXAMPLE_IMAGES[template.id] || EXAMPLE_IMAGES.general,
  labelTR: `${template.labelTR} Fotoğraf Seti`,
  labelEN: `${template.labelEN} Photo Set`,
  descriptionTR: template.descriptionTR,
  descriptionEN: template.descriptionEN,
  scenes: extractScenes(template.systemPrompt),
}));

export function getPhotoSetById(id) {
  return PHOTO_SETS.find((set) => set.id === id) ?? PHOTO_SETS.find((set) => set.id === "general");
}
