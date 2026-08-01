import { S3Client } from "@aws-sdk/client-s3";
import env from "./env";

// Initialize S3 client with AWS / Cloudflare R2 credentials
const s3Client = new S3Client({
  region: (env.aws.region as string) || "auto",
  credentials: {
    accessKeyId: env.aws.accessKeyId as string,
    secretAccessKey: env.aws.secretKey as string,
  },
  ...(env.aws.s3Endpoint ? { endpoint: env.aws.s3Endpoint } : {}),
});

export default s3Client;
