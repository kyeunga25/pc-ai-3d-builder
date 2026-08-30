import { describe, expect, it } from "vitest";

import { assetFileLimits } from "./asset-files";
import { assetReviewItemSchema, emptyAssetSourceFiles } from "./assets";

function item() {
  return {
    id: "asset-multi-view-fixture",
    part: {
      id: "part-multi-view-fixture",
      sku: "MULTI-VIEW-FIXTURE",
      manufacturer: "Synthetic Maker",
      model: "Synthetic Model",
    },
    status: "draft",
    quality: "unreviewed",
    sourceKind: "uploaded",
    completedChecks: [],
    sourceRightsConfirmed: false,
    files: {
      sources: {
        front: { contentType: "image/png", sizeBytes: 128 },
        back: { contentType: "image/jpeg", sizeBytes: 256 },
        left: { contentType: "image/webp", sizeBytes: 512 },
        "three-quarter": null,
      },
      model: null,
    },
    dimensionsMm: { width: null, height: null, depth: null },
    version: 3,
  };
}

describe("asset review multi-view source contract", () => {
  it("requires one bounded metadata slot for every canonical source view", () => {
    expect(assetReviewItemSchema.parse(item()).files.sources).toEqual({
      front: { contentType: "image/png", sizeBytes: 128 },
      back: { contentType: "image/jpeg", sizeBytes: 256 },
      left: { contentType: "image/webp", sizeBytes: 512 },
      "three-quarter": null,
    });

    const missingView = item();
    Reflect.deleteProperty(missingView.files.sources, "left");
    expect(assetReviewItemSchema.safeParse(missingView).success).toBe(false);

    const oversizedView = item();
    oversizedView.files.sources.back = {
      contentType: "image/jpeg",
      sizeBytes: assetFileLimits.source + 1,
    };
    expect(assetReviewItemSchema.safeParse(oversizedView).success).toBe(false);
  });

  it("creates a fresh all-null source map without sharing mutable state", () => {
    const first = emptyAssetSourceFiles();
    const second = emptyAssetSourceFiles();
    first.front = { contentType: "image/png", sizeBytes: 1 };

    expect(second).toEqual({
      front: null,
      back: null,
      left: null,
      "three-quarter": null,
    });
  });
});
