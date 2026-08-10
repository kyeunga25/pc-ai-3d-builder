import { describe, expect, it } from "vitest";

import {
  assetReviewHeaderCopy,
  assetReviewHeaderEyebrowCopy,
  assetReviewQualityCopy,
  assetReviewQueueSuffixCopy,
  assetReviewSourceKindCopy,
  assetReviewStatusPresentation,
} from "./asset-review-metadata-copy";

describe("Asset Review metadata copy", () => {
  it("keeps every static header and metadata label bilingual", () => {
    for (const copy of Object.values(assetReviewHeaderCopy)) {
      expect(copy.zhHant).toMatch(/[\u3400-\u9fff]/u);
      expect(copy.english).toMatch(/[A-Za-z]/u);
    }
  });

  it("covers every review status, source kind and quality exactly once", () => {
    expect(Object.keys(assetReviewStatusPresentation)).toEqual([
      "draft",
      "in_review",
      "approved",
      "rejected",
    ]);
    expect(Object.keys(assetReviewSourceKindCopy)).toEqual([
      "synthetic",
      "uploaded",
      "generated",
    ]);
    expect(Object.keys(assetReviewQualityCopy)).toEqual([
      "unreviewed",
      "draft",
      "reviewed",
      "approved",
    ]);

    const copies = [
      ...Object.values(assetReviewStatusPresentation).map(({ copy }) => copy),
      ...Object.values(assetReviewSourceKindCopy),
      ...Object.values(assetReviewQualityCopy),
    ];
    for (const copy of copies) {
      expect(copy.zhHant).toMatch(/[\u3400-\u9fff]/u);
      expect(copy.english).toMatch(/[A-Za-z]/u);
    }
  });

  it("formats version and queue context with correct English plurality", () => {
    expect(assetReviewHeaderEyebrowCopy(3)).toEqual({
      english: "Private asset · Version 3",
      zhHant: "私人素材 · 版本 3",
    });
    expect(assetReviewQueueSuffixCopy(false, 1).english).toBe(
      " · 1 item in queue",
    );
    expect(assetReviewQueueSuffixCopy(false, 2).english).toBe(
      " · 2 items in queue",
    );
    expect(assetReviewQueueSuffixCopy(true, 9)).toEqual({
      english: " · Selected asset",
      zhHant: " · 指定素材",
    });
  });
});
