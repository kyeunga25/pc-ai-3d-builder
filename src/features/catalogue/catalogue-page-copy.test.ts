import { describe, expect, it } from "vitest";

import {
  bilingualCataloguePageTitle,
  catalogueAssetQualityCopy,
  catalogueAssetStatusPresentation,
  catalogueCategoryCopy,
  cataloguePageCopy,
  catalogueStockCountCopy,
  catalogueStockStatusPresentation,
  catalogueVerifiedFilterCopy,
  catalogueViewProductTitle,
} from "./catalogue-page-copy";

const bilingualCopyPattern = {
  english: /[A-Za-z]/u,
  zhHant: /[\u3400-\u9fff]/u,
};

function expectBilingual(copy: { english: string; zhHant: string }) {
  expect(copy.zhHant).toMatch(bilingualCopyPattern.zhHant);
  expect(copy.english).toMatch(bilingualCopyPattern.english);
  expect(bilingualCataloguePageTitle(copy)).toBe(
    `${copy.zhHant} / ${copy.english}`,
  );
}

describe("Catalogue page copy", () => {
  it("keeps all static, category and quality labels bilingual", () => {
    for (const copy of Object.values(cataloguePageCopy)) {
      expectBilingual(copy);
    }
    expect(Object.keys(catalogueCategoryCopy)).toHaveLength(9);
    for (const copy of Object.values(catalogueCategoryCopy)) {
      expectBilingual(copy);
    }
    expect(Object.keys(catalogueAssetQualityCopy)).toHaveLength(4);
    for (const copy of Object.values(catalogueAssetQualityCopy)) {
      expectBilingual(copy);
    }
  });

  it("exhaustively maps stock and asset states with their existing tones", () => {
    expect(catalogueStockStatusPresentation).toEqual(
      expect.objectContaining({
        in_stock: expect.objectContaining({ tone: "success" }),
        low_stock: expect.objectContaining({ tone: "warning" }),
        out_of_stock: expect.objectContaining({ tone: "danger" }),
        unknown: expect.objectContaining({ tone: "neutral" }),
      }),
    );
    expect(Object.keys(catalogueStockStatusPresentation)).toHaveLength(4);
    expect(catalogueAssetStatusPresentation).toEqual(
      expect.objectContaining({
        approved: expect.objectContaining({ tone: "success" }),
        needs_review: expect.objectContaining({ tone: "warning" }),
        draft: expect.objectContaining({ tone: "info" }),
        proxy: expect.objectContaining({ tone: "neutral" }),
      }),
    );
    expect(Object.keys(catalogueAssetStatusPresentation)).toHaveLength(4);
    for (const presentation of [
      ...Object.values(catalogueStockStatusPresentation),
      ...Object.values(catalogueAssetStatusPresentation),
    ]) {
      expectBilingual(presentation.copy);
    }
  });

  it("uses correct stock singular, plural and unknown copy", () => {
    expect(catalogueStockCountCopy(1).english).toBe("1 unit");
    expect(catalogueStockCountCopy(2).english).toBe("2 units");
    expect(catalogueStockCountCopy(null).english).toBe(
      "Stock count unverified",
    );
  });

  it("keeps filter and dynamic product actions bilingual", () => {
    expect(catalogueVerifiedFilterCopy(false)).toBe(
      cataloguePageCopy.verifiedOnly,
    );
    expect(catalogueVerifiedFilterCopy(true)).toBe(
      cataloguePageCopy.showAllSpecifications,
    );
    expect(catalogueViewProductTitle("Synthetic", "Component")).toBe(
      "查看 Synthetic Component / View Synthetic Component",
    );
  });
});
