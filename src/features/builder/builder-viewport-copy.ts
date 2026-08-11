import type {
  CatalogPart,
  ComponentCategory,
} from "../../shared/domain/schemas";

export type BuilderViewportCopy = {
  readonly english: string;
  readonly zhHant: string;
};

export type BuilderCameraPreset = "等角" | "正面" | "左側" | "頂部";
export type BuilderDisplayMode = "著色" | "線框" | "靜態預覽";
export type BuilderStepId = ComponentCategory | "summary";

type BuilderPlaceholderState = {
  readonly hasApprovedAsset: boolean;
  readonly isLocalPreview: boolean;
  readonly isLocalSyntheticModel: boolean;
  readonly modelState: "error" | "loading" | "none";
};

function bilingualViewportCopy(
  zhHant: string,
  english: string,
): BuilderViewportCopy {
  return { english, zhHant };
}

export function bilingualViewportTitle(copy: BuilderViewportCopy): string {
  return `${copy.zhHant} / ${copy.english}`;
}

export const builderCameraPresets = [
  "等角",
  "正面",
  "左側",
  "頂部",
] as const satisfies readonly BuilderCameraPreset[];

export const builderViewportCameraCopy = {
  等角: bilingualViewportCopy("等角", "Isometric"),
  正面: bilingualViewportCopy("正面", "Front"),
  左側: bilingualViewportCopy("左側", "Left"),
  頂部: bilingualViewportCopy("頂部", "Top"),
} as const satisfies Record<BuilderCameraPreset, BuilderViewportCopy>;

export const builderViewportDisplayModeCopy = {
  著色: bilingualViewportCopy("著色", "Shaded"),
  線框: bilingualViewportCopy("線框", "Wireframe"),
  靜態預覽: bilingualViewportCopy("靜態預覽", "Static preview"),
} as const satisfies Record<BuilderDisplayMode, BuilderViewportCopy>;

export const builderViewportCategoryCopy = {
  case: bilingualViewportCopy("機箱", "Case"),
  motherboard: bilingualViewportCopy("主機板", "Motherboard"),
  cpu: bilingualViewportCopy("處理器", "CPU"),
  gpu: bilingualViewportCopy("顯示卡", "GPU"),
  memory: bilingualViewportCopy("記憶體", "Memory"),
  cooling: bilingualViewportCopy("散熱器", "Cooling"),
  storage: bilingualViewportCopy("儲存裝置", "Storage"),
  psu: bilingualViewportCopy("電源供應器", "Power supply"),
  fans: bilingualViewportCopy("風扇", "Fans"),
  summary: bilingualViewportCopy("總覽", "Summary"),
} as const satisfies Record<BuilderStepId, BuilderViewportCopy>;

export const builderViewportStockCopy = {
  in_stock: bilingualViewportCopy(
    "目錄記錄可選",
    "Selectable catalogue record",
  ),
  low_stock: bilingualViewportCopy(
    "低庫存目錄記錄",
    "Low-stock catalogue record",
  ),
  out_of_stock: bilingualViewportCopy("缺貨", "Out of stock"),
  unknown: bilingualViewportCopy("庫存未核實", "Stock unverified"),
} as const satisfies Record<CatalogPart["stockStatus"], BuilderViewportCopy>;

export const builderViewportCopy = {
  cameraGroupLabel: bilingualViewportCopy(
    "鏡頭預設角度",
    "Camera preset angles",
  ),
  cameraLabel: bilingualViewportCopy("鏡頭", "Camera"),
  currentCategoryComponent: bilingualViewportCopy(
    "目前類別組件",
    "Current category component",
  ),
  displayLabel: bilingualViewportCopy("顯示", "Display"),
  evidenceBoundary: bilingualViewportCopy(
    "視覺素材不構成相容性證據",
    "Visual material is not compatibility evidence",
  ),
  fitView: bilingualViewportCopy("調整至合適視野", "Fit model to view"),
  gridReadout: bilingualViewportCopy("網格 10 毫米", "10 mm grid"),
  modelComponentLoading: bilingualViewportCopy(
    "正在載入 3D 預覽元件…",
    "Loading the 3D preview component…",
  ),
  noSelection: bilingualViewportCopy("尚未選擇", "No component selected"),
  sceneDetails: bilingualViewportCopy(
    "場景 v1 · +Y 向上 · 單位：米",
    "Scene v1 · +Y up · Unit: metre",
  ),
  viewportLabel: bilingualViewportCopy(
    "3D 組件預覽視窗",
    "3D component preview viewport",
  ),
} as const satisfies Record<string, BuilderViewportCopy>;

export function builderViewportCameraReadoutCopy(
  camera: BuilderCameraPreset,
): BuilderViewportCopy {
  const copy = builderViewportCameraCopy[camera];
  return bilingualViewportCopy(
    `鏡頭：${copy.zhHant}`,
    `Camera: ${copy.english}`,
  );
}

export function builderViewportDisplayReadoutCopy(
  mode: BuilderDisplayMode,
): BuilderViewportCopy {
  const copy = builderViewportDisplayModeCopy[mode];
  return bilingualViewportCopy(`模式：${copy.zhHant}`, `Mode: ${copy.english}`);
}

export function builderViewportEditingCopy(
  category: BuilderStepId,
): BuilderViewportCopy {
  const copy = builderViewportCategoryCopy[category];
  return bilingualViewportCopy(
    `正在編輯：${copy.zhHant}`,
    `Editing: ${copy.english}`,
  );
}

export function builderViewportModelCaptionCopy(
  isLocalSyntheticModel: boolean,
): BuilderViewportCopy {
  return isLocalSyntheticModel
    ? bilingualViewportCopy(
        "已核准本機合成 GLB · 不含真實供應商輸出",
        "Approved local synthetic GLB · No real provider output",
      )
    : bilingualViewportCopy(
        "已核准私人 GLB · 只在目前瀏覽器工作階段解碼",
        "Approved private GLB · Decoded only in this browser session",
      );
}

export function builderViewportPlaceholderCopy({
  hasApprovedAsset,
  isLocalPreview,
  isLocalSyntheticModel,
  modelState,
}: BuilderPlaceholderState): BuilderViewportCopy {
  if (modelState === "loading") {
    return isLocalSyntheticModel
      ? bilingualViewportCopy(
          "正在準備已核准本機合成 GLB…",
          "Preparing the approved local synthetic GLB…",
        )
      : bilingualViewportCopy(
          "正在透過授權 API 載入私人 GLB…",
          "Loading the private GLB through the authorized API…",
        );
  }
  if (modelState === "error") {
    return bilingualViewportCopy(
      "無法讀取已核准私人 GLB；檔案仍保持私人，現正顯示靜態後備。",
      "Unable to load the approved private GLB. The file remains private; a static fallback is shown.",
    );
  }
  if (hasApprovedAsset && isLocalPreview) {
    return bilingualViewportCopy(
      "本地預覽不讀取私人 GLB；顯示合成幾何後備。",
      "Local preview does not read a private GLB; a synthetic geometry fallback is shown.",
    );
  }
  return bilingualViewportCopy(
    "此組件未有可用的已核准 GLB；顯示靜態幾何後備。",
    "No approved GLB is available for this component; a static geometry fallback is shown.",
  );
}

export function builderViewportFooterPreviewCopy(
  hasModel: boolean,
  isLocalSyntheticModel: boolean,
): BuilderViewportCopy {
  if (!hasModel) {
    return bilingualViewportCopy("提供靜態後備預覽", "Static fallback preview");
  }
  return isLocalSyntheticModel
    ? bilingualViewportCopy(
        "本機合成的已核准組件預覽",
        "Approved local synthetic component preview",
      )
    : bilingualViewportCopy(
        "受保護的已核准組件預覽",
        "Protected approved component preview",
      );
}
