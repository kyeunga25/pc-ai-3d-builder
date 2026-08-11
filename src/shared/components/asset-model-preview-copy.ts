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
} as const satisfies Record<string, AssetModelPreviewBilingualCopy>;

export function assetModelPreviewLabel(
  copy: AssetModelPreviewBilingualCopy,
): string {
  return `${copy.zhHant} / ${copy.english}`;
}
