import { bilingualCopy, type BilingualCopy } from "./asset-review-status";

export const assetReviewSourceViews = [
  "正面",
  "背面",
  "左側",
  "三分之四角度",
] as const;

export type AssetReviewSourceView = (typeof assetReviewSourceViews)[number];

export const assetReviewSourceViewCopy = {
  正面: bilingualCopy("正面", "Front"),
  背面: bilingualCopy("背面", "Back"),
  左側: bilingualCopy("左側", "Left"),
  三分之四角度: bilingualCopy("三分之四角度", "Three-quarter"),
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
        `${copy.zhHant}來源圖片介面佔位`,
        `${copy.english} source-image interface placeholder`,
      );
}

export function assetReviewSourcePreviewAltCopy(
  manufacturer: string,
  model: string,
): BilingualCopy {
  const productName = `${manufacturer} ${model}`.trim();
  return bilingualCopy(
    `${productName} 私人來源預覽`,
    `Private source preview for ${productName}`,
  );
}
