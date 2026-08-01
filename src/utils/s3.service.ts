import env from "@/config/env";
import s3Client from "@/config/s3";
import { PutObjectCommand } from "@aws-sdk/client-s3";

const upload = async (key: string, body: Buffer, mimeType?: string) => {
  const command = new PutObjectCommand({
    Bucket: env.aws.s3bucketName,
    Key: key,
    Body: body,
    ...(mimeType ? { ContentType: mimeType } : {}),
  });

  await s3Client.send(command);
  // file url will be like this
  const fileUrl = env.aws.s3PublicUrl
    ? `${env.aws.s3PublicUrl.replace(/\/$/, "")}/${key}`
    : `https://${env.aws.s3bucketName}.s3.${env.aws.region}.amazonaws.com/${key}`;

  return fileUrl;
};

const s3Service = {
  upload,
};
export default s3Service;
