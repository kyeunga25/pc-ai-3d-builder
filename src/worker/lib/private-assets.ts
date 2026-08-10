import {
  AssetFileValidationError,
  assetFileLimits,
  validateAssetFileBytes,
} from "../../shared/domain/asset-files";
import { sha256Hex } from "./digest";

export function assetObjectKey(
  workspaceId: string,
  assetId: string,
  kind: "model" | "source",
  objectId: string = crypto.randomUUID(),
): string {
  return `workspaces/${workspaceId}/assets/${assetId}/${kind}/${objectId}`;
}

export async function privateObjectMetadataMatches(
  bucket: R2Bucket,
  objectKey: string,
  contentType: string,
  sizeBytes: number,
): Promise<boolean> {
  const stored = await bucket.head(objectKey);
  return (
    stored !== null &&
    stored.size === sizeBytes &&
    stored.httpMetadata?.contentType === contentType
  );
}

export async function privateModelObjectMatches(
  bucket: R2Bucket,
  objectKey: string,
  contentType: string,
  sizeBytes: number,
  sha256: string,
): Promise<boolean> {
  if (
    !Number.isSafeInteger(sizeBytes) ||
    sizeBytes <= 0 ||
    sizeBytes > assetFileLimits.model ||
    !/^[a-f0-9]{64}$/u.test(sha256)
  ) {
    return false;
  }
  const stored = await bucket.get(objectKey);
  if (
    !stored ||
    stored.size !== sizeBytes ||
    stored.httpMetadata?.contentType !== contentType
  ) {
    return false;
  }
  const bytes = new Uint8Array(await stored.arrayBuffer());
  if (bytes.byteLength !== sizeBytes) {
    return false;
  }
  try {
    validateAssetFileBytes("model", contentType, bytes);
  } catch (error) {
    if (error instanceof AssetFileValidationError) {
      return false;
    }
    throw error;
  }
  return (await sha256Hex(bytes)) === sha256;
}

export async function deletePrivateObjectQuietly(
  bucket: R2Bucket,
  objectKey: string | null,
): Promise<void> {
  if (!objectKey) {
    return;
  }
  try {
    await bucket.delete(objectKey);
  } catch {
    // A stale private object is safer than failing a committed D1 transition.
  }
}

export async function putPrivateObject(
  bucket: R2Bucket,
  objectKey: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<void> {
  const stored = await bucket.put(objectKey, bytes, {
    httpMetadata: { contentType, cacheControl: "no-store" },
  });
  if (!stored) {
    throw new Error("Private asset object could not be stored.");
  }
}
