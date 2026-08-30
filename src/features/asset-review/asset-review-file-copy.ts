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
    "靜態 JPEG、PNG 或 WebP · 最多 10 MiB／8,192 px／24 MP",
    "Static JPEG, PNG or WebP · Up to 10 MiB / 8,192 px / 24 MP",
  ),
  syntheticImage: bilingualCopy("合成圖片", "Create synthetic image"),
  syntheticImageTitle: bilingualCopy(
    "建立只保留在目前本機工作階段的合成 PNG",
    "Create a synthetic PNG kept only in this local session",
  ),
  sourceUploadTitle: bilingualCopy(
    "上載或取代所選來源視角會重設核准證據；不會刪除其他私人檔案",
    "Uploading or replacing the selected source view resets approval evidence; it does not delete other private files",
  ),
  sourceRemoveTitle: bilingualCopy(
    "再次確認後只會移除所選來源視角，並重設所有核准證據",
    "After confirmation, only the selected source view is removed and all approval evidence is reset",
  ),
  model: bilingualCopy("3D 模型", "3D model"),
  modelRequirements: bilingualCopy(
    "自包含及資源有界的 glTF 2.0 GLB · 最多 25 MiB",
    "Self-contained, resource-bounded glTF 2.0 GLB · Up to 25 MiB",
  ),
  modelUploadTitle: bilingualCopy(
    "上載或取代 GLB 會重設核准證據；不會刪除任何來源圖片",
    "Uploading or replacing the GLB resets approval evidence; it does not delete any source image",
  ),
  modelRemoveTitle: bilingualCopy(
    "再次確認後只會移除私人 GLB，並重設所有核准證據",
    "After confirmation, only the private GLB is removed and all approval evidence is reset",
  ),
  replacementWarning: bilingualCopy(
    "取代或移除任何檔案會重設核准清單、來源權利確認及已核實尺寸，避免沿用舊版本判斷。操作只影響所選視角或 GLB；其他私人檔案仍保持私人。",
    "Replacing or removing any file resets the approval checklist, source-rights confirmation and verified dimensions so old evidence is not reused. The operation affects only the selected view or GLB; all other private files remain private.",
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

export function assetReviewFileRemoveActionCopy(
  kind: AssetFileKind,
  armed: boolean,
  removing: boolean,
): BilingualCopy {
  if (removing) {
    return kind === "source"
      ? bilingualCopy("移除圖片中…", "Removing image…")
      : bilingualCopy("移除 GLB 中…", "Removing GLB…");
  }
  if (armed) {
    return kind === "source"
      ? bilingualCopy("確認移除圖片", "Confirm image removal")
      : bilingualCopy("確認移除 GLB", "Confirm GLB removal");
  }
  return kind === "source"
    ? bilingualCopy("移除圖片", "Remove image")
    : bilingualCopy("移除 GLB", "Remove GLB");
}

export function nextAssetReviewFileRemoveIntent(
  armedKey: string | null,
  currentKey: string,
): { nextArmedKey: string | null; shouldSubmit: boolean } {
  if (armedKey === currentKey) {
    return { nextArmedKey: null, shouldSubmit: true };
  }
  return { nextArmedKey: currentKey, shouldSubmit: false };
}
