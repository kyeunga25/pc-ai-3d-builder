import type { DashboardWorkItem } from "./dashboard";

type DashboardWorkCopy = Pick<
  DashboardWorkItem,
  | "detailEnglish"
  | "detailZhHant"
  | "kind"
  | "statusEnglish"
  | "statusZhHant"
  | "tone"
>;

function englishCount(value: number, singular: string): string {
  return `${value} ${singular}${value === 1 ? "" : "s"}`;
}

export function dashboardAssetReviewWorkCopy(
  status: "draft" | "in_review",
): DashboardWorkCopy {
  return {
    kind: "asset_review",
    detailZhHant:
      status === "in_review" ? "3D 素材正在審核" : "3D 素材草稿等待處理",
    detailEnglish:
      status === "in_review"
        ? "3D asset is under review"
        : "3D asset draft awaits review",
    statusZhHant: status === "in_review" ? "審核中" : "需要審核",
    statusEnglish: status === "in_review" ? "Under review" : "Review required",
    tone: "warning",
  };
}

export function dashboardBuildWorkCopy({
  errorCount,
  partCount,
  unknownCount,
}: {
  errorCount: number;
  partCount: number;
  unknownCount: number;
}): DashboardWorkCopy {
  const hasError = errorCount > 0;
  const ready = !hasError && unknownCount === 0;
  return {
    kind: ready ? "build_ready" : "build_attention",
    detailZhHant: ready
      ? `${partCount} 個組件 · 可安全匯出`
      : `${errorCount} 個嚴重錯誤 · ${unknownCount} 個未知結果`,
    detailEnglish: ready
      ? `${englishCount(partCount, "component")} · Safe to export`
      : `${englishCount(errorCount, "critical error")} · ${englishCount(unknownCount, "unknown result")}`,
    statusZhHant: ready ? "可匯出" : hasError ? "需要修正" : "資料未齊",
    statusEnglish: ready
      ? "Export ready"
      : hasError
        ? "Fix required"
        : "Data incomplete",
    tone: ready ? "success" : hasError ? "danger" : "warning",
  };
}
