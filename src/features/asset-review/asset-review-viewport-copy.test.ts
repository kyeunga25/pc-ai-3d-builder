import { describe, expect, it } from "vitest";

import {
  assetReviewCameraPresetCopy,
  assetReviewCameraPresets,
  assetReviewCameraReadoutCopy,
  assetReviewViewportCopy,
} from "./asset-review-viewport-copy";

describe("Asset Review viewport copy", () => {
  it("keeps every static viewport label bilingual", () => {
    for (const copy of Object.values(assetReviewViewportCopy)) {
      expect(copy.zhHant).toMatch(/[\u3400-\u9fff]/u);
      expect(copy.english).toMatch(/[A-Za-z]/u);
    }
  });

  it("covers every supported camera preset exactly once", () => {
    expect(Object.keys(assetReviewCameraPresetCopy)).toEqual(
      assetReviewCameraPresets,
    );

    for (const copy of Object.values(assetReviewCameraPresetCopy)) {
      expect(copy.zhHant).toMatch(/[\u3400-\u9fff]/u);
      expect(copy.english).toMatch(/[A-Za-z]/u);
    }
  });

  it("formats the selected camera readout bilingually", () => {
    expect(assetReviewCameraReadoutCopy("等角")).toEqual({
      english: "Camera: Isometric",
      zhHant: "鏡頭：等角",
    });
  });
});
