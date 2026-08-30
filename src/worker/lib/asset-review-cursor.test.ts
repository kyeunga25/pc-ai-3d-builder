import { describe, expect, it } from "vitest";

import {
  decodeAssetReviewCursor,
  encodeAssetReviewCursor,
} from "./asset-review-cursor";

describe("asset review cursor", () => {
  it("round-trips one deterministic bounded marker without a raw asset ID", () => {
    const marker = {
      assetId: "asset-private-fixture",
      updatedAt: "2026-08-30 12:34:56",
    };
    const cursor = encodeAssetReviewCursor(marker);

    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/u);
    expect(cursor).not.toContain(marker.assetId);
    expect(encodeAssetReviewCursor(marker)).toBe(cursor);
    expect(decodeAssetReviewCursor(cursor)).toEqual(marker);
  });

  it.each([
    "",
    "invalid/cursor",
    "A".repeat(513),
    "bm90LWpzb24",
    "eyJpIjoiLi4vZXNjYXBlIiwidSI6IjIwMjYtMDgtMzAgMTI6MzQ6NTYifQ",
  ])("rejects a malformed or unbounded cursor: %s", (cursor) => {
    expect(decodeAssetReviewCursor(cursor)).toBeNull();
  });

  it("rejects a marker outside the D1 timestamp range", () => {
    for (const updatedAt of ["2026-08-30 24:00:00", "2026-02-30 12:00:00"]) {
      expect(() =>
        encodeAssetReviewCursor({
          assetId: "asset-private-fixture",
          updatedAt,
        }),
      ).toThrow();
    }
  });
});
