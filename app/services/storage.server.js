import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.S3_API,
  credentials: {
    accessKeyId: process.env.Access_Key_S3,
    secretAccessKey: process.env.Secret_S3,
  },
});

const BUCKET = process.env.R2_BUCKET;
const PUBLIC_URL = (process.env.R2_PUBLIC_URL || "").replace(/\/$/, "");

// Downloads an image from a (temporary) source URL and re-uploads it to R2,
// returning a permanent public URL. Falls back to the source URL on failure
// so a storage outage never breaks generation.
export async function persistImage(sourceUrl, key) {
  try {
    const res = await fetch(sourceUrl);
    if (!res.ok) throw new Error(`fetch failed: ${res.status}`);

    const buffer = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") || "image/jpeg";

    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );

    return `${PUBLIC_URL}/${key}`;
  } catch (err) {
    console.error("[storage] persistImage failed, keeping source URL:", err.message);
    return sourceUrl;
  }
}
