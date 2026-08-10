import {
  type AssetReviewCheck,
  type AssetReviewItem,
} from "../../shared/domain/assets";
import { bilingualCopy, type BilingualCopy } from "./asset-review-status";

export type AssetReviewDimensionKey = keyof AssetReviewItem["dimensionsMm"];

export const assetReviewEvidenceCopy = {
  dimensionsHeading: bilingualCopy("核實尺寸", "Verified dimensions"),
  dimensionsGuidance: bilingualCopy(
    "只接受經人手核對的數值",
    "Only enter values checked by a person",
  ),
  checklistHeading: bilingualCopy("核准清單", "Approval checklist"),
} as const satisfies Record<string, BilingualCopy>;

export const assetReviewChecklistCopy = {
  model_identity: bilingualCopy("型號及 SKU 正確", "Model and SKU are correct"),
  variant_identity: bilingualCopy(
    "顏色及版本正確",
    "Colour and variant are correct",
  ),
  standard_orientation: bilingualCopy(
    "已設定標準方向",
    "Standard orientation is set",
  ),
  verified_dimensions: bilingualCopy(
    "已輸入核實尺寸",
    "Verified dimensions are entered",
  ),
  installation_pivot: bilingualCopy(
    "樞軸適合作安裝",
    "Pivot is suitable for installation",
  ),
  source_rights: bilingualCopy(
    "已確認圖片使用權",
    "Image usage rights are confirmed",
  ),
} as const satisfies Record<AssetReviewCheck, BilingualCopy>;

export const assetReviewDimensionItems = [
  { key: "width", copy: bilingualCopy("闊度", "Width") },
  { key: "height", copy: bilingualCopy("高度", "Height") },
  { key: "depth", copy: bilingualCopy("深度", "Depth") },
] as const satisfies ReadonlyArray<{
  key: AssetReviewDimensionKey;
  copy: BilingualCopy;
}>;

export function assetReviewChecklistProgressCopy(
  completed: number,
  total: number,
): BilingualCopy {
  const englishNoun = total === 1 ? "check" : "checks";
  return bilingualCopy(
    `已完成 ${completed} / ${total} 項`,
    `${completed} of ${total} ${englishNoun} complete`,
  );
}
