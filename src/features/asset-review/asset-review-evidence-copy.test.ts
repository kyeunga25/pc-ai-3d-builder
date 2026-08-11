import { describe, expect, it } from "vitest";

import { assetReviewChecks } from "../../shared/domain/assets";
import {
  assetReviewChecklistCopy,
  assetReviewChecklistProgressCopy,
  assetReviewDimensionItems,
  assetReviewEvidenceCopy,
} from "./asset-review-evidence-copy";

describe("Asset Review evidence copy", () => {
  it("keeps every heading and guidance label bilingual", () => {
    for (const copy of Object.values(assetReviewEvidenceCopy)) {
      expect(copy.zhHant).toMatch(/[\u3400-\u9fff]/u);
      expect(copy.english).toMatch(/[A-Za-z]/u);
    }
  });

  it("covers every approval check exactly once and bilingually", () => {
    expect(Object.keys(assetReviewChecklistCopy)).toEqual(assetReviewChecks);

    for (const copy of Object.values(assetReviewChecklistCopy)) {
      expect(copy.zhHant).toMatch(/[\u3400-\u9fff]/u);
      expect(copy.english).toMatch(/[A-Za-z]/u);
    }
  });

  it("covers all three verified dimensions bilingually", () => {
    expect(assetReviewDimensionItems.map(({ key }) => key)).toEqual([
      "width",
      "height",
      "depth",
    ]);

    for (const { copy } of assetReviewDimensionItems) {
      expect(copy.zhHant).toMatch(/[\u3400-\u9fff]/u);
      expect(copy.english).toMatch(/[A-Za-z]/u);
    }
  });

  it("formats approval progress with correct English singular and plural", () => {
    expect(assetReviewChecklistProgressCopy(1, 1)).toEqual({
      english: "1 of 1 check complete",
      zhHant: "已完成 1 / 1 項",
    });
    expect(assetReviewChecklistProgressCopy(5, 6)).toEqual({
      english: "5 of 6 checks complete",
      zhHant: "已完成 5 / 6 項",
    });
  });
});
