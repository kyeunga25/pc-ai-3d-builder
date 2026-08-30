export type AssetModelPreviewBilingualCopy = {
  zhHant: string;
  english: string;
};

export const assetModelPreviewCopy = {
  canvasLabel: {
    zhHant: "可旋轉的私人 GLB 模型",
    english: "Rotatable private GLB model",
  },
  loading: {
    zhHant: "正在解碼私人 GLB…",
    english: "Decoding private GLB…",
  },
  error: {
    zhHant: "無法顯示此 GLB；檔案仍維持私人。",
    english: "This GLB cannot be displayed; the file remains private.",
  },
  partial: {
    zhHant: "部分 GLB 未能顯示；已載入的檔案仍可在私人場景檢查。",
    english:
      "Some GLBs could not be displayed; loaded files remain available in the private scene.",
  },
  reviewCanvasLabel: {
    zhHant: "可旋轉的私人多組件 GLB 檢視場景",
    english: "Rotatable private multi-component GLB review scene",
  },
} as const satisfies Record<string, AssetModelPreviewBilingualCopy>;

export function assetModelPreviewLabel(
  copy: AssetModelPreviewBilingualCopy,
): string {
  return `${copy.zhHant} / ${copy.english}`;
}
