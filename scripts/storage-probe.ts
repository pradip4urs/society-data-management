import "dotenv/config";
import { S3Client, HeadBucketCommand } from "@aws-sdk/client-s3";
if (process.env.NODE_ENV === "production")
  throw new Error("Storage probe is local-only");
const endpoint = process.env.S3_ENDPOINT ?? "http://127.0.0.1:9000";
if (new URL(endpoint).hostname !== "127.0.0.1")
  throw new Error("Probe requires local S3");
const bucket = process.env.S3_BUCKET ?? "society-private";
const s3 = new S3Client({
  endpoint,
  region: "us-east-1",
  forcePathStyle: true,
  credentials: {
    accessKeyId: "local_storage",
    secretAccessKey: "local_storage_only_change_me",
  },
});
try {
  await s3.send(new HeadBucketCommand({ Bucket: bucket }));
  const anonymous = await fetch(`${endpoint}/${bucket}?list-type=2`);
  if (anonymous.status !== 403)
    throw new Error("Anonymous storage access was not denied");
  console.log(
    "Private S3 probe passed: signed bucket access works; anonymous list denied.",
  );
} finally {
  s3.destroy();
}
