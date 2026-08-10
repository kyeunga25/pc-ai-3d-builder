import type { BuildCompatibilitySummary } from "../../shared/domain/builds";

export type BuilderStatusBarCopy = {
  readonly english: string;
  readonly zhHant: string;
};

export type BuilderCompatibilityTone =
  "error" | "unknown" | "warning" | "success";

function statusBarCopy(zhHant: string, english: string): BuilderStatusBarCopy {
  return { english, zhHant };
}

export function bilingualStatusBarTitle(copy: BuilderStatusBarCopy): string {
  return `${copy.zhHant} / ${copy.english}`;
}

export const builderStatusBarCopy = {
  barLabel: statusBarCopy("組裝狀態摘要", "Build status summary"),
  compatibility: statusBarCopy("相容性", "Compatibility"),
  export: statusBarCopy("匯出", "Export"),
  exportBlocked: statusBarCopy(
    "先儲存變更，並解決嚴重錯誤及未知相容性結果",
    "Save changes and resolve errors and unknown compatibility results first",
  ),
  exportReady: statusBarCopy(
    "匯出不含身份、價格、庫存及私人素材的 JSON",
    "Export JSON without identity, pricing, stock or private assets",
  ),
  save: statusBarCopy("儲存", "Save"),
  selectedComponents: statusBarCopy("已選組件", "Selected components"),
  workspaceTotal: statusBarCopy("工作空間總價", "Workspace total"),
} as const satisfies Record<string, BuilderStatusBarCopy>;

export function builderCompatibilitySummaryPresentation(
  summary: BuildCompatibilitySummary,
): {
  readonly copy: BuilderStatusBarCopy;
  readonly tone: BuilderCompatibilityTone;
} {
  if (summary.errorCount > 0) {
    return {
      copy: statusBarCopy(
        `${summary.errorCount} 項嚴重錯誤`,
        `${summary.errorCount} critical error${summary.errorCount === 1 ? "" : "s"}`,
      ),
      tone: "error",
    };
  }

  if (summary.unknownCount > 0) {
    return {
      copy: statusBarCopy(
        `${summary.unknownCount} 項結果未知`,
        `${summary.unknownCount} unknown result${summary.unknownCount === 1 ? "" : "s"}`,
      ),
      tone: "unknown",
    };
  }

  if (summary.warningCount > 0) {
    return {
      copy: statusBarCopy(
        `尚有 ${summary.warningCount} 項警告`,
        `${summary.warningCount} warning${summary.warningCount === 1 ? "" : "s"} remaining`,
      ),
      tone: "warning",
    };
  }

  return {
    copy: statusBarCopy("已通過所有可用規則", "All available rules passed"),
    tone: "success",
  };
}

export function builderSelectedComponentsCopy(
  selectedCount: number,
): BuilderStatusBarCopy {
  return statusBarCopy(
    `已選 ${selectedCount} / 9 項組件`,
    `${selectedCount} of 9 components selected`,
  );
}

export function builderStatusBarExportTitle(canExport: boolean): string {
  return bilingualStatusBarTitle(
    canExport
      ? builderStatusBarCopy.exportReady
      : builderStatusBarCopy.exportBlocked,
  );
}
