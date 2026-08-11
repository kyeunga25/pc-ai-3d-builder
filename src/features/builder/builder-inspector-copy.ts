import type { CompatibilityFinding } from "../../shared/domain/builds";
import type { CatalogPart } from "../../shared/domain/schemas";

export type BuilderInspectorCopy = {
  readonly english: string;
  readonly zhHant: string;
};

export type BuilderInspectorTab = "asset" | "compatibility" | "details";

export function bilingualBuilderCopy(
  zhHant: string,
  english: string,
): BuilderInspectorCopy {
  return { english, zhHant };
}

export function bilingualBuilderTitle(copy: BuilderInspectorCopy): string {
  return `${copy.zhHant} / ${copy.english}`;
}

export const builderInspectorCopy = {
  assetGuidance: bilingualBuilderCopy(
    "組裝相容性不會由視覺模型推斷。私人 GLB 只可經授權載入。",
    "Visual models do not determine compatibility. A private GLB may be loaded only after authorization.",
  ),
  assetHeading: bilingualBuilderCopy("3D 素材狀態", "3D asset status"),
  assetQualityLabel: bilingualBuilderCopy("品質", "Quality"),
  assetStatusLabel: bilingualBuilderCopy("素材狀態", "Asset status"),
  assetUsageLabel: bilingualBuilderCopy("使用條件", "Usage condition"),
  compatibilityGuidance: bilingualBuilderCopy(
    "只使用已核實的目錄欄位；缺少資料會顯示為未知，不會猜測。",
    "Only verified catalogue fields are used. Missing data is shown as unknown and is never guessed.",
  ),
  compatibilityHeading: bilingualBuilderCopy(
    "可解釋相容性證據",
    "Explainable compatibility evidence",
  ),
  emptyGuidance: bilingualBuilderCopy(
    "先選擇左側類別及目錄產品，再查看規格與相容性證據。",
    "Select a category and catalogue product first, then review specifications and compatibility evidence.",
  ),
  emptyHeading: bilingualBuilderCopy("尚未選擇組件", "No component selected"),
  inspectorTabsLabel: bilingualBuilderCopy("檢查器分頁", "Inspector tabs"),
  noRules: bilingualBuilderCopy(
    "此類別目前沒有結構化相容性規則。",
    "No structured compatibility rules apply to this category.",
  ),
  relatedRulesHeading: bilingualBuilderCopy(
    "相關規則結果",
    "Related rule results",
  ),
  selectedComponent: bilingualBuilderCopy("已選組件", "Selected component"),
  skuLabel: bilingualBuilderCopy("產品 SKU", "Product SKU"),
  structuredSpecificationsHeading: bilingualBuilderCopy(
    "結構化規格",
    "Structured specifications",
  ),
} as const satisfies Record<string, BuilderInspectorCopy>;

export const builderInspectorTabCopy = {
  details: bilingualBuilderCopy("詳情", "Details"),
  compatibility: bilingualBuilderCopy("相容性", "Compatibility"),
  asset: bilingualBuilderCopy("3D 素材", "3D asset"),
} as const satisfies Record<BuilderInspectorTab, BuilderInspectorCopy>;

export const builderInspectorSeverityCopy = {
  pass: bilingualBuilderCopy("通過", "Passed"),
  warning: bilingualBuilderCopy("警告", "Warning"),
  error: bilingualBuilderCopy("錯誤", "Error"),
  unknown: bilingualBuilderCopy("待核實", "Needs verification"),
} as const satisfies Record<
  CompatibilityFinding["severity"],
  BuilderInspectorCopy
>;

export const builderInspectorAssetStatusCopy = {
  approved: bilingualBuilderCopy("已核准", "Approved"),
  needs_review: bilingualBuilderCopy("需要審核", "Needs review"),
  draft: bilingualBuilderCopy("草稿", "Draft"),
  proxy: bilingualBuilderCopy("代理預覽", "Proxy preview"),
} as const satisfies Record<CatalogPart["assetStatus"], BuilderInspectorCopy>;

export const builderInspectorAssetQualityCopy = {
  unreviewed: bilingualBuilderCopy("未審核", "Unreviewed"),
  draft: bilingualBuilderCopy("草稿品質", "Draft quality"),
  reviewed: bilingualBuilderCopy("已審核", "Reviewed"),
  approved: bilingualBuilderCopy("已核准", "Approved"),
} as const satisfies Record<CatalogPart["assetQuality"], BuilderInspectorCopy>;

export const builderInspectorSpecificationStatusCopy = {
  unverified: bilingualBuilderCopy("規格未核實", "Specifications unverified"),
  verified: bilingualBuilderCopy("規格已核實", "Specifications verified"),
} as const satisfies Record<
  CatalogPart["specificationStatus"],
  BuilderInspectorCopy
>;

export const builderInspectorSpecificationCopy = {
  capacityGb: bilingualBuilderCopy("容量（GB）", "Capacity (GB)"),
  capacityWatts: bilingualBuilderCopy("容量（W）", "Capacity (W)"),
  coolerHeightMm: bilingualBuilderCopy(
    "散熱器高度（mm）",
    "Cooler height (mm)",
  ),
  count: bilingualBuilderCopy("數量", "Count"),
  formFactor: bilingualBuilderCopy("尺寸規格", "Form factor"),
  interface: bilingualBuilderCopy("介面", "Interface"),
  lengthMm: bilingualBuilderCopy("長度（mm）", "Length (mm)"),
  maxCoolerHeightMm: bilingualBuilderCopy(
    "散熱器淨空（mm）",
    "Cooler clearance (mm)",
  ),
  maxGpuLengthMm: bilingualBuilderCopy(
    "顯示卡淨空（mm）",
    "GPU clearance (mm)",
  ),
  memoryType: bilingualBuilderCopy("記憶體類型", "Memory type"),
  recommendedPsuWatts: bilingualBuilderCopy(
    "建議電源（W）",
    "Recommended PSU (W)",
  ),
  sizeMm: bilingualBuilderCopy("尺寸（mm）", "Size (mm)"),
  slotWidth: bilingualBuilderCopy("插槽厚度", "Slot width"),
  socket: bilingualBuilderCopy("插槽", "Socket"),
  speedMts: bilingualBuilderCopy("速度（MT/s）", "Speed (MT/s)"),
  supportedMotherboardFormFactors: bilingualBuilderCopy(
    "支援主機板尺寸",
    "Supported motherboard form factors",
  ),
  tdpWatts: bilingualBuilderCopy("散熱設計功耗 TDP（W）", "TDP (W)"),
} as const satisfies Record<string, BuilderInspectorCopy>;

export function builderInspectorSpecificationLabelCopy(
  key: string,
): BuilderInspectorCopy {
  return (
    builderInspectorSpecificationCopy[
      key as keyof typeof builderInspectorSpecificationCopy
    ] ?? bilingualBuilderCopy(`自訂欄位：${key}`, `Custom field: ${key}`)
  );
}

export function builderInspectorStockCopy(
  count: number | null,
): BuilderInspectorCopy {
  if (count === null) {
    return bilingualBuilderCopy("庫存未提供", "Stock count unavailable");
  }
  return bilingualBuilderCopy(
    `${count} 件庫存`,
    `${count} ${count === 1 ? "item" : "items"} in stock`,
  );
}

export function builderInspectorUsageCopy(
  status: CatalogPart["assetStatus"],
): BuilderInspectorCopy {
  return status === "approved"
    ? bilingualBuilderCopy(
        "已核准，可供人手預覽",
        "Approved for manual preview",
      )
    : bilingualBuilderCopy("不可當作已核准素材", "Not approved for use");
}
