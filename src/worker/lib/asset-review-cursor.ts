import { z } from "zod";

import {
  assetReviewCursorMaxLength,
  assetReviewCursorPattern,
  assetReviewRecordIdPattern,
} from "../../shared/lib/asset-review-pagination";

const assetReviewUpdatedAtPattern =
  /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01]) (?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/u;

function isCanonicalD1Timestamp(value: string): boolean {
  const parsed = new Date(`${value.replace(" ", "T")}Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 19).replace("T", " ") === value
  );
}

const assetReviewUpdatedAtSchema = z
  .string()
  .length(19)
  .regex(assetReviewUpdatedAtPattern)
  .refine(isCanonicalD1Timestamp);

const cursorPayloadSchema = z.object({
  i: z.string().regex(assetReviewRecordIdPattern),
  u: assetReviewUpdatedAtSchema,
});

export type AssetReviewCursorMarker = {
  assetId: string;
  updatedAt: string;
};

function toBase64Url(value: string): string {
  return btoa(value)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

function fromBase64Url(value: string): string {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  return atob(`${base64}${padding}`);
}

export function encodeAssetReviewCursor(
  marker: AssetReviewCursorMarker,
): string {
  const payload = cursorPayloadSchema.parse({
    i: marker.assetId,
    u: marker.updatedAt,
  });
  return toBase64Url(JSON.stringify(payload));
}

export function decodeAssetReviewCursor(
  cursor: string,
): AssetReviewCursorMarker | null {
  if (
    cursor.length < 1 ||
    cursor.length > assetReviewCursorMaxLength ||
    !assetReviewCursorPattern.test(cursor)
  ) {
    return null;
  }

  try {
    const parsed = cursorPayloadSchema.safeParse(
      JSON.parse(fromBase64Url(cursor)) as unknown,
    );
    return parsed.success
      ? { assetId: parsed.data.i, updatedAt: parsed.data.u }
      : null;
  } catch {
    return null;
  }
}
