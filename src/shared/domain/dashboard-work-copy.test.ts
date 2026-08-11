import { describe, expect, it } from "vitest";

import {
  dashboardAssetReviewWorkCopy,
  dashboardBuildWorkCopy,
} from "./dashboard-work-copy";

describe("dashboard work copy", () => {
  it("covers both pending asset-review states bilingually", () => {
    expect(dashboardAssetReviewWorkCopy("in_review")).toEqual({
      detailEnglish: "3D asset is under review",
      detailZhHant: "3D 素材正在審核",
      kind: "asset_review",
      statusEnglish: "Under review",
      statusZhHant: "審核中",
      tone: "warning",
    });
    expect(dashboardAssetReviewWorkCopy("draft")).toEqual({
      detailEnglish: "3D asset draft awaits review",
      detailZhHant: "3D 素材草稿等待處理",
      kind: "asset_review",
      statusEnglish: "Review required",
      statusZhHant: "需要審核",
      tone: "warning",
    });
  });

  it("distinguishes export-ready, error and unknown build states", () => {
    expect(
      dashboardBuildWorkCopy({
        errorCount: 0,
        partCount: 1,
        unknownCount: 0,
      }),
    ).toEqual({
      detailEnglish: "1 component · Safe to export",
      detailZhHant: "1 個組件 · 可安全匯出",
      kind: "build_ready",
      statusEnglish: "Export ready",
      statusZhHant: "可匯出",
      tone: "success",
    });
    expect(
      dashboardBuildWorkCopy({
        errorCount: 2,
        partCount: 9,
        unknownCount: 1,
      }),
    ).toMatchObject({
      detailEnglish: "2 critical errors · 1 unknown result",
      kind: "build_attention",
      statusEnglish: "Fix required",
      statusZhHant: "需要修正",
      tone: "danger",
    });
    expect(
      dashboardBuildWorkCopy({
        errorCount: 0,
        partCount: 4,
        unknownCount: 3,
      }),
    ).toMatchObject({
      detailEnglish: "0 critical errors · 3 unknown results",
      kind: "build_attention",
      statusEnglish: "Data incomplete",
      statusZhHant: "資料未齊",
      tone: "warning",
    });
  });
});
