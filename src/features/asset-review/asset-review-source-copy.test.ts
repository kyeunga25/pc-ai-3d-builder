import { describe, expect, it } from "vitest";

import {
  assetReviewSourceCopy,
  assetReviewSourceFrameCopy,
  assetReviewSourcePreviewAltCopy,
  assetReviewSourceViewCopy,
  assetReviewSourceViews,
} from "./asset-review-source-copy";

describe("Asset Review source-image copy", () => {
  it("keeps every source state bilingual", () => {
    for (const copy of Object.values(assetReviewSourceCopy)) {
      expect(copy.zhHant).toMatch(/[\u3400-\u9fff]/u);
      expect(copy.english).toMatch(/[A-Za-z]/u);
    }
  });

  it("covers each supported source view exactly once", () => {
    expect(Object.keys(assetReviewSourceViewCopy)).toEqual(
      assetReviewSourceViews,
    );

    for (const copy of Object.values(assetReviewSourceViewCopy)) {
      expect(copy.zhHant).toMatch(/[\u3400-\u9fff]/u);
      expect(copy.english).toMatch(/[A-Za-z]/u);
    }
  });

  it("describes private previews and placeholders without an asset ID", () => {
    expect(assetReviewSourceFrameCopy("正面", true)).toEqual({
      english: "Front private source image",
      zhHant: "正面私人來源圖片",
    });
    expect(assetReviewSourceFrameCopy("背面", false)).toEqual({
      english: "Back source-image interface placeholder",
      zhHant: "背面來源圖片介面佔位",
    });
    expect(
      assetReviewSourcePreviewAltCopy("Fixture Maker", "Fixture Model"),
    ).toEqual({
      english: "Private source preview for Fixture Maker Fixture Model",
      zhHant: "Fixture Maker Fixture Model 私人來源預覽",
    });
  });
});
