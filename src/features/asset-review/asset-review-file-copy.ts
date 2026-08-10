import type { AssetFileKind } from "../../shared/domain/asset-files";
import { bilingualCopy, type BilingualCopy } from "./asset-review-status";

export const assetReviewFileControlCopy = {
  heading: bilingualCopy("私人素材檔案", "Private asset files"),
  accessBoundary: bilingualCopy(
    "Access 及 workspace 驗證後才可讀取",
    "Access and workspace checks are required before reading",
  ),
  sourceImage: bilingualCopy("來源圖片", "Source image"),
  sourceRequirements: bilingualCopy(
    "JPEG、PNG 或 WebP · 最多 10 MiB",
    "JPEG, PNG or WebP · Up to 10 MiB",
  ),
  syntheticImage: bilingualCopy("合成圖片", "Create synthetic image"),
  syntheticImageTitle: bilingualCopy(
    "建立只保留在目前本機工作階段的合成 PNG",
    "Create a synthetic PNG kept only in this local session",
  ),
  sourceUploadTitle: bilingualCopy(
    "上載或取代來源圖片會重設核准證據；不會刪除其他私人檔案",
    "Uploading or replacing the source image resets approval evidence; it does not delete other private files",
  ),
  model: bilingualCopy("3D 模型", "3D model"),
  modelRequirements: bilingualCopy(
    "自包含 glTF 2.0 GLB · 最多 25 MiB",
    "Self-contained glTF 2.0 GLB · Up to 25 MiB",
  ),
  modelUploadTitle: bilingualCopy(
    "上載或取代 GLB 會重設核准證據；不會刪除來源圖片",
    "Uploading or replacing the GLB resets approval evidence; it does not delete the source image",
  ),
  replacementWarning: bilingualCopy(
    "取代任何檔案會重設核准清單及已核實尺寸，避免沿用舊版本判斷。只會取代所選檔案；另一個私人檔案仍保持私人。",
    "Replacing either file resets the approval checklist and verified dimensions so old evidence is not reused. Only the selected file is replaced; the other private file remains private.",
  ),
} as const satisfies Record<string, BilingualCopy>;

export function assetReviewFileActionCopy(
  kind: AssetFileKind,
  exists: boolean,
  uploading: boolean,
): BilingualCopy {
  if (uploading) {
    return bilingualCopy("上載中…", "Uploading…");
  }
  if (kind === "source") {
    return exists
      ? bilingualCopy("取代圖片", "Replace image")
      : bilingualCopy("上載圖片", "Upload image");
  }
  return exists
    ? bilingualCopy("取代 GLB", "Replace GLB")
    : bilingualCopy("上載 GLB", "Upload GLB");
}
