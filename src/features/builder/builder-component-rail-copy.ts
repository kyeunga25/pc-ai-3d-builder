import type { CompatibilityFinding } from "../../shared/domain/builds";
import type {
  CatalogPart,
  ComponentCategory,
  StockStatus,
} from "../../shared/domain/schemas";

export type BuilderComponentCopy = {
  readonly english: string;
  readonly zhHant: string;
};

export type BuilderComponentStepId = ComponentCategory | "summary";

type BuilderComponentStepTone =
  "complete" | "error" | "pending" | "unknown" | "warning";

function componentCopy(zhHant: string, english: string): BuilderComponentCopy {
  return { english, zhHant };
}

export function builderComponentTitle(copy: BuilderComponentCopy): string {
  return `${copy.zhHant} / ${copy.english}`;
}

export const builderComponentStepOrder = [
  "case",
  "motherboard",
  "cpu",
  "gpu",
  "memory",
  "cooling",
  "storage",
  "psu",
  "fans",
  "summary",
] as const satisfies readonly BuilderComponentStepId[];

export const builderComponentStepCopy = {
  case: {
    full: componentCopy("機箱", "Case"),
    short: componentCopy("機箱", "Case"),
  },
  motherboard: {
    full: componentCopy("主機板", "Motherboard"),
    short: componentCopy("主機板", "Board"),
  },
  cpu: {
    full: componentCopy("處理器", "Processor"),
    short: componentCopy("處理器", "CPU"),
  },
  gpu: {
    full: componentCopy("顯示卡", "Graphics card"),
    short: componentCopy("顯示卡", "GPU"),
  },
  memory: {
    full: componentCopy("記憶體", "Memory"),
    short: componentCopy("記憶體", "RAM"),
  },
  cooling: {
    full: componentCopy("散熱器", "Cooling"),
    short: componentCopy("散熱", "Cooling"),
  },
  storage: {
    full: componentCopy("儲存裝置", "Storage"),
    short: componentCopy("儲存", "Storage"),
  },
  psu: {
    full: componentCopy("電源供應器", "Power supply"),
    short: componentCopy("電源", "PSU"),
  },
  fans: {
    full: componentCopy("風扇", "Fans"),
    short: componentCopy("風扇", "Fans"),
  },
  summary: {
    full: componentCopy("總覽", "Summary"),
    short: componentCopy("總覽", "Summary"),
  },
} as const satisfies Record<
  BuilderComponentStepId,
  { readonly full: BuilderComponentCopy; readonly short: BuilderComponentCopy }
>;

export const builderComponentRailCopy = {
  buildComponents: componentCopy("組裝組件", "Build components"),
  buildSummary: componentCopy("組裝總覽", "Build summary"),
  candidateItems: componentCopy("產品候選項目", "Catalogue candidates"),
  chooseCandidate: componentCopy(
    "從上方目錄候選項目選擇",
    "Choose from the catalogue candidates above",
  ),
  currentBuild: componentCopy("目前組裝", "Current build"),
  noCandidates: componentCopy(
    "目錄內暫時沒有此類別的可選產品。",
    "No selectable catalogue products are available in this category.",
  ),
  noSelection: componentCopy("尚未選擇", "No component selected"),
  saveBoundary: componentCopy(
    "只會使用目前工作空間的目錄記錄；選擇要按「儲存」才會寫入 D1。",
    "Only catalogue records from the current workspace are used. Select Save to write the selection to D1.",
  ),
  selectedComponent: componentCopy("已選組件", "Selected component"),
  summaryGuidance: componentCopy(
    "總覽會列出可解釋的規則結果；相容性不會由 3D 外觀推斷。",
    "The summary lists explainable rule results. Compatibility is never inferred from 3D appearance.",
  ),
} as const satisfies Record<string, BuilderComponentCopy>;

const regularStateCopy = {
  error: componentCopy("錯誤", "Error"),
  pending: componentCopy("未選", "Not selected"),
  unknown: componentCopy("待核實", "Needs verification"),
  warning: componentCopy("警告", "Warning"),
  complete: componentCopy("已選", "Selected"),
} as const satisfies Record<BuilderComponentStepTone, BuilderComponentCopy>;

const summaryStateCopy = {
  error: componentCopy("有錯誤", "Has errors"),
  unknown: componentCopy("待核實", "Needs verification"),
  warning: componentCopy("有警告", "Has warnings"),
  complete: componentCopy("可匯出", "Export ready"),
} as const;

export function builderComponentStepState(
  step: BuilderComponentStepId,
  selectedParts: CatalogPart[],
  findings: CompatibilityFinding[],
): {
  readonly copy: BuilderComponentCopy;
  readonly tone: BuilderComponentStepTone;
} {
  if (step === "summary") {
    if (findings.some((finding) => finding.severity === "error")) {
      return { copy: summaryStateCopy.error, tone: "error" };
    }
    if (findings.some((finding) => finding.severity === "unknown")) {
      return { copy: summaryStateCopy.unknown, tone: "unknown" };
    }
    if (findings.some((finding) => finding.severity === "warning")) {
      return { copy: summaryStateCopy.warning, tone: "warning" };
    }
    return { copy: summaryStateCopy.complete, tone: "complete" };
  }

  const related = findings.filter((finding) =>
    finding.categories.includes(step),
  );
  if (related.some((finding) => finding.severity === "error")) {
    return { copy: regularStateCopy.error, tone: "error" };
  }
  if (!selectedParts.some((part) => part.category === step)) {
    return { copy: regularStateCopy.pending, tone: "pending" };
  }
  if (related.some((finding) => finding.severity === "unknown")) {
    return { copy: regularStateCopy.unknown, tone: "unknown" };
  }
  if (related.some((finding) => finding.severity === "warning")) {
    return { copy: regularStateCopy.warning, tone: "warning" };
  }
  return { copy: regularStateCopy.complete, tone: "complete" };
}

export function builderComponentSelectedCountCopy(
  count: number,
): BuilderComponentCopy {
  return componentCopy(`已選 ${count} / 9 項`, `${count} of 9 selected`);
}

export function builderComponentCandidatesCountCopy(
  count: number,
): BuilderComponentCopy {
  return componentCopy(
    `${count} 項`,
    `${count} ${count === 1 ? "option" : "options"}`,
  );
}

export function builderComponentSelectedCategoriesCopy(
  count: number,
): BuilderComponentCopy {
  return componentCopy(
    `${count} 個類別`,
    `${count} ${count === 1 ? "category" : "categories"} selected`,
  );
}

export function builderComponentOptionsCopy(
  step: BuilderComponentStepId,
): BuilderComponentCopy {
  if (step === "summary") {
    return builderComponentRailCopy.buildSummary;
  }
  const label = builderComponentStepCopy[step].full;
  return componentCopy(
    `${label.zhHant}選項`,
    `${label.english === "Graphics card" ? "GPU" : label.english} options`,
  );
}

export function builderComponentCandidateStockCopy({
  stockCount,
  stockStatus,
}: {
  readonly stockCount: number | null;
  readonly stockStatus: StockStatus;
}): BuilderComponentCopy {
  if (stockStatus === "out_of_stock") {
    return componentCopy("目前缺貨", "Currently out of stock");
  }
  if (stockStatus === "unknown") {
    return componentCopy("庫存未核實", "Stock unverified");
  }
  if (stockCount === null) {
    return componentCopy("庫存未提供", "Stock count unavailable");
  }
  if (stockStatus === "low_stock") {
    return componentCopy(
      `${stockCount} 件低庫存`,
      `${stockCount} low-stock ${stockCount === 1 ? "item" : "items"}`,
    );
  }
  return componentCopy(
    `${stockCount} 件現貨`,
    `${stockCount} ${stockCount === 1 ? "item" : "items"} in stock`,
  );
}
