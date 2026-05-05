import "server-only";
import { S3Client } from "@aws-sdk/client-s3";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";

const endpoint = process.env.S3_ENDPOINT;
const region = process.env.S3_REGION ?? "auto";
const bucket = process.env.S3_BUCKET ?? "stack-os-uploads";
const accessKeyId = process.env.S3_ACCESS_KEY_ID;
const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

const client = endpoint && accessKeyId && secretAccessKey
  ? new S3Client({
      region,
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
    })
  : null;

export interface SignedUploadUrl {
  url: string;
  key: string;
  expiresInSeconds: number;
}

/**
 * Sign a PUT URL for direct browser-to-storage upload.
 * Key shape: `<orgId>/<targetType>/<targetId>/<uuid>-<filename>`.
 */
export async function signUploadUrl(args: {
  orgId: string;
  targetType: string;
  targetId: string;
  filename: string;
  contentType: string;
  expiresInSeconds?: number;
}): Promise<SignedUploadUrl> {
  if (!client) {
    throw new Error("storage_not_configured");
  }
  const safeName = args.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `${args.orgId}/${args.targetType}/${args.targetId}/${randomUUID()}-${safeName}`;
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: args.contentType,
  });
  const expiresIn = args.expiresInSeconds ?? 15 * 60;
  const url = await getSignedUrl(client, command, { expiresIn });
  return { url, key, expiresInSeconds: expiresIn };
}

export async function signReadUrl(key: string, expiresInSeconds = 300): Promise<string> {
  if (!client) throw new Error("storage_not_configured");
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

export const storageConfigured = (): boolean => client !== null;
