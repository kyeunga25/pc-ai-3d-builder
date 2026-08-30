import { describe, expect, it } from "vitest";

import { reviewAsset } from "../../shared/domain/mockData";
import {
  appendAssetReviewQueueItems,
  assetReviewFormHasUnsavedChanges,
  assetReviewQueueNavigationState,
  replaceAssetReviewQueueItem,
} from "./asset-review-queue-state";

const secondAsset = {
  ...reviewAsset,
  id: "asset-review-second",
  part: { ...reviewAsset.part, id: "part-review-second", model: "Second" },
};

describe("asset review queue state", () => {
  it("treats raw invalid dimension input as an unsaved change", () => {
    const cleanDraft = {
      checks: new Set(reviewAsset.completedChecks),
      dimensions: {
        width: reviewAsset.dimensionsMm.width?.toString() ?? "",
        height: reviewAsset.dimensionsMm.height?.toString() ?? "",
        depth: reviewAsset.dimensionsMm.depth?.toString() ?? "",
      },
    };
    expect(assetReviewFormHasUnsavedChanges(reviewAsset, cleanDraft)).toBe(
      false,
    );
    expect(
      assetReviewFormHasUnsavedChanges(reviewAsset, {
        ...cleanDraft,
        dimensions: { ...cleanDraft.dimensions, width: "not-a-dimension" },
      }),
    ).toBe(true);
  });

  it("moves through loaded records and requests another page only at the end", () => {
    expect(
      assetReviewQueueNavigationState({
        activeAssetId: reviewAsset.id,
        blocked: false,
        items: [reviewAsset, secondAsset],
        nextCursor: "cursor-next",
      }),
    ).toMatchObject({ activeIndex: 0, canPrevious: false, next: "loaded" });
    expect(
      assetReviewQueueNavigationState({
        activeAssetId: secondAsset.id,
        blocked: false,
        items: [reviewAsset, secondAsset],
        nextCursor: "cursor-next",
      }),
    ).toMatchObject({ activeIndex: 1, canPrevious: true, next: "page" });
  });

  it("blocks every queue transition while the current form is unsafe to leave", () => {
    expect(
      assetReviewQueueNavigationState({
        activeAssetId: secondAsset.id,
        blocked: true,
        items: [reviewAsset, secondAsset],
        nextCursor: "cursor-next",
      }),
    ).toMatchObject({ canPrevious: false, next: null });
  });

  it("updates current records and appends pages without duplicate IDs", () => {
    const updated = { ...reviewAsset, version: reviewAsset.version + 1 };
    expect(
      replaceAssetReviewQueueItem([reviewAsset, secondAsset], updated),
    ).toEqual([updated, secondAsset]);
    expect(
      appendAssetReviewQueueItems([reviewAsset], [updated, secondAsset]),
    ).toEqual([updated, secondAsset]);
  });
});
