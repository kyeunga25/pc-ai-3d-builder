import {
  AssetFileValidationError,
  assetFileLimits,
  validateAssetFileBytes,
  type AssetFileKind,
} from "../../shared/domain/asset-files";
import { sha256Hex } from "./digest";

type PrivateObjectExpectation = {
  contentType: string;
  digestBytes: Uint8Array;
  kind: AssetFileKind;
  sha256: string;
  sizeBytes: number;
};

export type VerifiedPrivateObject = {
  body: ReadableStream | ArrayBuffer;
  sizeBytes: number;
};

function parseExpectation(
  kind: AssetFileKind,
  contentType: string,
  sizeBytes: number,
  sha256: string,
): PrivateObjectExpectation | null {
  const validContentType =
    kind === "source"
      ? ["image/jpeg", "image/png", "image/webp"].includes(contentType)
      : contentType === "model/gltf-binary";
  if (
    !validContentType ||
    !Number.isSafeInteger(sizeBytes) ||
    sizeBytes <= 0 ||
    sizeBytes > assetFileLimits[kind] ||
    !/^[a-f0-9]{64}$/u.test(sha256)
  ) {
    return null;
  }
  const digestBytes = new Uint8Array(32);
  for (let index = 0; index < digestBytes.byteLength; index += 1) {
    digestBytes[index] = Number.parseInt(
      sha256.slice(index * 2, index * 2 + 2),
      16,
    );
  }
  return { contentType, digestBytes, kind, sha256, sizeBytes };
}

function metadataMatches(
  stored: R2Object,
  expectation: PrivateObjectExpectation,
): boolean {
  return (
    stored.size === expectation.sizeBytes &&
    stored.httpMetadata?.contentType === expectation.contentType
  );
}

function storedChecksumMatches(
  stored: R2Object,
  expected: Uint8Array,
): boolean | null {
  const checksums = (stored as R2Object & { checksums?: R2Checksums })
    .checksums;
  if (!checksums?.sha256) {
    return null;
  }
  const actual = new Uint8Array(checksums.sha256);
  if (actual.byteLength !== expected.byteLength) {
    return false;
  }
  let difference = 0;
  for (let index = 0; index < expected.byteLength; index += 1) {
    difference |= actual[index]! ^ expected[index]!;
  }
  return difference === 0;
}

async function readPrivateObjectBytes(
  bucket: R2Bucket,
  objectKey: string,
  expectation: PrivateObjectExpectation,
): Promise<Uint8Array | null> {
  const stored = await bucket.get(objectKey);
  if (!stored || !metadataMatches(stored, expectation)) {
    return null;
  }
  const bytes = new Uint8Array(await stored.arrayBuffer());
  if (bytes.byteLength !== expectation.sizeBytes) {
    return null;
  }
  try {
    validateAssetFileBytes(expectation.kind, expectation.contentType, bytes);
  } catch (error) {
    if (error instanceof AssetFileValidationError) {
      return null;
    }
    throw error;
  }
  return (await sha256Hex(bytes)) === expectation.sha256 ? bytes : null;
}

export function assetObjectKey(
  workspaceId: string,
  assetId: string,
  kind: "model" | "source",
  objectId: string = crypto.randomUUID(),
): string {
  return `workspaces/${workspaceId}/assets/${assetId}/${kind}/${objectId}`;
}

export async function privateObjectMatches(
  bucket: R2Bucket,
  objectKey: string,
  kind: AssetFileKind,
  contentType: string,
  sizeBytes: number,
  sha256: string,
): Promise<boolean> {
  const expectation = parseExpectation(kind, contentType, sizeBytes, sha256);
  if (!expectation) {
    return false;
  }
  const stored = await bucket.head(objectKey);
  if (!stored || !metadataMatches(stored, expectation)) {
    return false;
  }
  const checksumMatch = storedChecksumMatches(stored, expectation.digestBytes);
  if (checksumMatch !== null) {
    return checksumMatch;
  }
  return (
    (await readPrivateObjectBytes(bucket, objectKey, expectation)) !== null
  );
}

export async function getVerifiedPrivateObject(
  bucket: R2Bucket,
  objectKey: string,
  kind: AssetFileKind,
  contentType: string,
  sizeBytes: number,
  sha256: string,
): Promise<VerifiedPrivateObject | null> {
  const expectation = parseExpectation(kind, contentType, sizeBytes, sha256);
  if (!expectation) {
    return null;
  }
  const stored = await bucket.get(objectKey);
  if (!stored || !metadataMatches(stored, expectation)) {
    return null;
  }
  const checksumMatch = storedChecksumMatches(stored, expectation.digestBytes);
  if (checksumMatch === false) {
    return null;
  }
  if (checksumMatch === true) {
    return { body: stored.body, sizeBytes: stored.size };
  }
  const bytes = new Uint8Array(await stored.arrayBuffer());
  if (bytes.byteLength !== expectation.sizeBytes) {
    return null;
  }
  try {
    validateAssetFileBytes(kind, contentType, bytes);
  } catch (error) {
    if (error instanceof AssetFileValidationError) {
      return null;
    }
    throw error;
  }
  if ((await sha256Hex(bytes)) !== sha256) {
    return null;
  }
  return { body: bytes.buffer as ArrayBuffer, sizeBytes: bytes.byteLength };
}

export async function privateModelObjectMatches(
  bucket: R2Bucket,
  objectKey: string,
  contentType: string,
  sizeBytes: number,
  sha256: string,
): Promise<boolean> {
  const expectation = parseExpectation("model", contentType, sizeBytes, sha256);
  return expectation
    ? (await readPrivateObjectBytes(bucket, objectKey, expectation)) !== null
    : false;
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
  sha256: string,
): Promise<void> {
  const digestBytes = parseExpectation(
    contentType === "model/gltf-binary" ? "model" : "source",
    contentType,
    bytes.byteLength,
    sha256,
  )?.digestBytes;
  if (!digestBytes) {
    throw new Error("Private asset checksum metadata is invalid.");
  }
  const stored = await bucket.put(objectKey, bytes, {
    httpMetadata: { contentType, cacheControl: "no-store" },
    sha256: digestBytes,
  });
  if (!stored) {
    throw new Error("Private asset object could not be stored.");
  }
}
