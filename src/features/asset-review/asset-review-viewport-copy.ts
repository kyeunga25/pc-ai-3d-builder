import { bilingualCopy, type BilingualCopy } from "./asset-review-status";

export const assetReviewCameraPresets = [
  "正面",
  "左側",
  "頂部",
  "等角",
] as const;

export type AssetReviewCameraPreset = (typeof assetReviewCameraPresets)[number];

export const assetReviewCameraPresetCopy = {
  正面: bilingualCopy("正面", "Front"),
  左側: bilingualCopy("左側", "Left"),
  頂部: bilingualCopy("頂部", "Top"),
  等角: bilingualCopy("等角", "Isometric"),
} as const satisfies Record<AssetReviewCameraPreset, BilingualCopy>;

export const assetReviewViewportCopy = {
  viewportLabel: bilingualCopy("3D 素材審核視窗", "3D asset review viewport"),
  cameraGroupLabel: bilingualCopy("鏡頭預設角度", "Camera preset angles"),
  fitModel: bilingualCopy("調整模型至合適視野", "Fit model to view"),
  toggleWireframe: bilingualCopy("切換線框顯示", "Toggle wireframe view"),
  loadingComponent: bilingualCopy(
    "正在載入 3D 預覽元件…",
    "Loading 3D preview component…",
  ),
  authorizedModel: bilingualCopy(
    "授權讀取的私人 GLB · 只在目前瀏覽器工作階段解碼",
    "Authorized private GLB · Decoded only in this browser session",
  ),
  missingModel: bilingualCopy(
    "尚未上載私人 GLB · 顯示合成幾何佔位",
    "No private GLB uploaded · Showing a synthetic geometry placeholder",
  ),
  evidenceLimit: bilingualCopy(
    "視覺素材不構成相容性證明",
    "Visual material is not compatibility evidence",
  ),
} as const satisfies Record<string, BilingualCopy>;

export function assetReviewCameraReadoutCopy(
  preset: AssetReviewCameraPreset,
): BilingualCopy {
  const copy = assetReviewCameraPresetCopy[preset];
  return bilingualCopy(`鏡頭：${copy.zhHant}`, `Camera: ${copy.english}`);
}
