import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";

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

// Deletes all generated images for a shop, used on the SHOP_REDACT GDPR webhook.
export async function deleteShopImages(shop) {
  const prefix = `generations/${shop}/`;
  let continuationToken;

  do {
    const list = await s3.send(
      new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    );

    const objects = (list.Contents || []).map((o) => ({ Key: o.Key }));
    if (objects.length > 0) {
      await s3.send(
        new DeleteObjectsCommand({
          Bucket: BUCKET,
          Delete: { Objects: objects },
        })
      );
    }

    continuationToken = list.IsTruncated ? list.NextContinuationToken : undefined;
  } while (continuationToken);
}
