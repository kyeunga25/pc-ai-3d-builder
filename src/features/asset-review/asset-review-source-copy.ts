import {
  assetSourceViews,
  type AssetSourceView,
} from "../../shared/domain/asset-files";
import { bilingualCopy, type BilingualCopy } from "./asset-review-status";

export const assetReviewSourceViews = assetSourceViews;
export type AssetReviewSourceView = AssetSourceView;

export const assetReviewSourceViewCopy = {
  front: bilingualCopy("正面", "Front"),
  back: bilingualCopy("背面", "Back"),
  left: bilingualCopy("左側", "Left"),
  "three-quarter": bilingualCopy("三分之四角度", "Three-quarter"),
} as const satisfies Record<AssetReviewSourceView, BilingualCopy>;

export const assetReviewSourceCopy = {
  heading: bilingualCopy("來源圖片", "Source images"),
  loaded: bilingualCopy(
    "已透過授權 API 載入",
    "Loaded through the authorized API",
  ),
  missing: bilingualCopy(
    "尚未載入私人來源圖片",
    "No private source image loaded",
  ),
  rightsConfirmed: bilingualCopy(
    "已記錄商業使用權確認",
    "Commercial usage-rights confirmation recorded",
  ),
  rightsMissing: bilingualCopy(
    "尚未確認圖片使用權",
    "Image usage rights not confirmed",
  ),
} as const satisfies Record<string, BilingualCopy>;

export function assetReviewSourceFrameCopy(
  view: AssetReviewSourceView,
  hasPrivateImage: boolean,
): BilingualCopy {
  const copy = assetReviewSourceViewCopy[view];
  return hasPrivateImage
    ? bilingualCopy(
        `${copy.zhHant}私人來源圖片`,
        `${copy.english} private source image`,
      )
    : bilingualCopy(
        `${copy.zhHant}來源圖片尚未上載；選擇此視角後上載`,
        `${copy.english} source image not uploaded; select this view to upload`,
      );
}

export function assetReviewSourcePreviewAltCopy(
  manufacturer: string,
  model: string,
  view: AssetReviewSourceView,
): BilingualCopy {
  const productName = `${manufacturer} ${model}`.trim();
  const viewCopy = assetReviewSourceViewCopy[view];
  return bilingualCopy(
    `${productName} ${viewCopy.zhHant}私人來源預覽`,
    `${viewCopy.english} private source preview for ${productName}`,
  );
}
