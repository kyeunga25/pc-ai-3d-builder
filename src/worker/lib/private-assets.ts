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
