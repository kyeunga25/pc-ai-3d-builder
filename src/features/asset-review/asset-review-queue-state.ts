import type {
  AssetReviewCheck,
  AssetReviewItem,
} from "../../shared/domain/assets";

type AssetReviewDraftSnapshot = {
  checks: ReadonlySet<AssetReviewCheck>;
  dimensions: {
    width: string;
    height: string;
    depth: string;
  };
};

type AssetReviewQueueNavigationInput = {
  activeAssetId: string;
  blocked: boolean;
  items: AssetReviewItem[];
  nextCursor: string | null;
};

export type AssetReviewQueueNavigationState = {
  activeIndex: number;
  canPrevious: boolean;
  next: "loaded" | "page" | null;
};

export function assetReviewFormHasUnsavedChanges(
  asset: AssetReviewItem,
  draft: AssetReviewDraftSnapshot,
): boolean {
  const persistedChecks = new Set(asset.completedChecks);
  return (
    draft.checks.size !== persistedChecks.size ||
    [...draft.checks].some((check) => !persistedChecks.has(check)) ||
    draft.dimensions.width !== (asset.dimensionsMm.width?.toString() ?? "") ||
    draft.dimensions.height !== (asset.dimensionsMm.height?.toString() ?? "") ||
    draft.dimensions.depth !== (asset.dimensionsMm.depth?.toString() ?? "")
  );
}

export function assetReviewQueueNavigationState({
  activeAssetId,
  blocked,
  items,
  nextCursor,
}: AssetReviewQueueNavigationInput): AssetReviewQueueNavigationState {
  const activeIndex = items.findIndex((item) => item.id === activeAssetId);
  if (blocked || activeIndex < 0) {
    return { activeIndex, canPrevious: false, next: null };
  }
  if (activeIndex < items.length - 1) {
    return { activeIndex, canPrevious: activeIndex > 0, next: "loaded" };
  }
  return {
    activeIndex,
    canPrevious: activeIndex > 0,
    next: nextCursor === null ? null : "page",
  };
}

export function replaceAssetReviewQueueItem(
  items: AssetReviewItem[],
  updated: AssetReviewItem,
): AssetReviewItem[] {
  return items.map((item) => (item.id === updated.id ? updated : item));
}

export function appendAssetReviewQueueItems(
  current: AssetReviewItem[],
  incoming: AssetReviewItem[],
): AssetReviewItem[] {
  const positions = new Map(current.map((item, index) => [item.id, index]));
  const result = [...current];
  for (const item of incoming) {
    const position = positions.get(item.id);
    if (position === undefined) {
      positions.set(item.id, result.length);
      result.push(item);
    } else {
      result[position] = item;
    }
  }
  return result;
}
