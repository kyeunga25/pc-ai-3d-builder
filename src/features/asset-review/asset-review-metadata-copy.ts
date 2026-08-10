import type { AssetReviewItem } from "../../shared/domain/assets";
import { bilingualCopy, type BilingualCopy } from "./asset-review-status";

type AssetReviewBadgeTone = "danger" | "info" | "success" | "warning";

export const assetReviewHeaderCopy = {
  guidance: bilingualCopy(
    "所有生成或上載素材均為草稿，必須經授權人員核准才可使用。",
    "All generated or uploaded material remains a draft and requires approval by an authorized reviewer before use.",
  ),
  metadataHeading: bilingualCopy("素材資料", "Asset details"),
  qualityLabel: bilingualCopy("品質", "Quality"),
  reviewVersionLabel: bilingualCopy("審核版本", "Review version"),
  skuLabel: bilingualCopy("產品 SKU", "Product SKU"),
} as const satisfies Record<string, BilingualCopy>;

export const assetReviewStatusPresentation = {
  draft: {
    copy: bilingualCopy("草稿", "Draft"),
    tone: "info",
  },
  in_review: {
    copy: bilingualCopy("需要審核", "Needs review"),
    tone: "warning",
  },
  approved: {
    copy: bilingualCopy("已核准", "Approved"),
    tone: "success",
  },
  rejected: {
    copy: bilingualCopy("已拒絕", "Rejected"),
    tone: "danger",
  },
} as const satisfies Record<
  AssetReviewItem["status"],
  { readonly copy: BilingualCopy; readonly tone: AssetReviewBadgeTone }
>;

export const assetReviewSourceKindCopy = {
  synthetic: bilingualCopy("合成測試素材", "Synthetic test asset"),
  uploaded: bilingualCopy("私人上載素材", "Private uploaded asset"),
  generated: bilingualCopy("生成流程草稿", "Generation-pipeline draft"),
} as const satisfies Record<AssetReviewItem["sourceKind"], BilingualCopy>;

export const assetReviewQualityCopy = {
  unreviewed: bilingualCopy("未審核", "Unreviewed"),
  draft: bilingualCopy("草稿品質", "Draft quality"),
  reviewed: bilingualCopy("已審核", "Reviewed"),
  approved: bilingualCopy("已核准", "Approved"),
} as const satisfies Record<AssetReviewItem["quality"], BilingualCopy>;

export function assetReviewHeaderEyebrowCopy(version: number): BilingualCopy {
  return bilingualCopy(
    `私人素材 · 版本 ${version}`,
    `Private asset · Version ${version}`,
  );
}

export function assetReviewQueueSuffixCopy(
  selected: boolean,
  count: number,
): BilingualCopy {
  if (selected) {
    return bilingualCopy(" · 指定素材", " · Selected asset");
  }

  return bilingualCopy(
    ` · 佇列 ${count} 項`,
    ` · ${count} ${count === 1 ? "item" : "items"} in queue`,
  );
}
