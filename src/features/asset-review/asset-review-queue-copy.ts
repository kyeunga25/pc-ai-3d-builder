import { bilingualCopy, type BilingualCopy } from "./asset-review-status";

export const assetReviewQueueCopy = {
  heading: bilingualCopy("審核佇列導覽", "Asset review queue navigation"),
  previous: bilingualCopy("上一項", "Previous asset"),
  next: bilingualCopy("下一項", "Next asset"),
  loading: bilingualCopy("載入中…", "Loading…"),
  retry: bilingualCopy("重試下一頁", "Retry next page"),
} as const;

export function assetReviewQueuePositionCopy(
  position: number,
  loadedCount: number,
  hasMore: boolean,
): BilingualCopy {
  return bilingualCopy(
    `第 ${position} 項，共已載入 ${loadedCount} 項${hasMore ? "，尚有更多" : ""}`,
    `Item ${position} of ${loadedCount} loaded${hasMore ? "; more available" : ""}`,
  );
}
