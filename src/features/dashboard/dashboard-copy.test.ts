import { describe, expect, it } from "vitest";

import {
  dashboardApprovedAssetCopy,
  dashboardAttentionBuildCopy,
  dashboardEvaluatedBuildCopy,
  dashboardInterfaceCopy,
  dashboardReadinessNoteCopy,
  dashboardUsableCatalogueCopy,
  dashboardVerifiedCatalogueCopy,
  dashboardWorkCountCopy,
  relativeDashboardUpdateCopy,
} from "./dashboard-copy";

const now = Date.parse("2026-08-10T10:00:00.000Z");

describe("Dashboard relative update copy", () => {
  it.each([
    ["invalid", "最近更新", "Recently updated"],
    ["2026-08-10T09:59:40.000Z", "剛剛", "Just now"],
    ["2026-08-10T09:30:00.000Z", "30 分鐘前", "30 minutes ago"],
    ["2026-08-10 08:00:00", "2 小時前", "2 hours ago"],
    ["2026-08-07T10:00:00.000Z", "3 日前", "3 days ago"],
    ["2026-08-02T10:00:00.000Z", "較早更新", "Earlier update"],
  ])(
    "formats %s in Traditional Chinese and English",
    (value, zhHant, english) => {
      expect(relativeDashboardUpdateCopy(value, now)).toEqual({
        english,
        zhHant,
      });
    },
  );

  it("uses singular English units", () => {
    expect(
      relativeDashboardUpdateCopy("2026-08-10T09:59:00.000Z", now).english,
    ).toBe("1 minute ago");
    expect(
      relativeDashboardUpdateCopy("2026-08-10T09:00:00.000Z", now).english,
    ).toBe("1 hour ago");
    expect(
      relativeDashboardUpdateCopy("2026-08-09T10:00:00.000Z", now).english,
    ).toBe("1 day ago");
  });
});

describe("Dashboard interface copy", () => {
  it("keeps every static interface label bilingual", () => {
    for (const copy of Object.values(dashboardInterfaceCopy)) {
      expect(copy.zhHant).toMatch(/[\u3400-\u9fff]/u);
      expect(copy.english).toMatch(/[A-Za-z]/u);
    }
  });

  it("formats metric and work counts bilingually", () => {
    expect(dashboardVerifiedCatalogueCopy(11)).toEqual({
      english: "11 specifications verified",
      zhHant: "11 項規格已核實",
    });
    expect(dashboardApprovedAssetCopy(6)).toEqual({
      english: "6 assets approved",
      zhHant: "6 項素材已核准",
    });
    expect(dashboardAttentionBuildCopy(1)).toEqual({
      english: "1 recent draft needs attention",
      zhHant: "1 個最近草稿需要處理",
    });
    expect(dashboardWorkCountCopy(2)).toEqual({
      english: "2 items",
      zhHant: "2 項",
    });
    expect(dashboardUsableCatalogueCopy(1)).toEqual({
      english: "1 item usable",
      zhHant: "1 項可使用",
    });
  });

  it("describes complete and bounded build evaluation windows", () => {
    expect(
      dashboardEvaluatedBuildCopy({
        draftBuildCount: 1,
        evaluatedBuildCount: 1,
        readyBuildCount: 1,
      }),
    ).toEqual({
      english: "1 draft passed the export gate",
      zhHant: "1 個草稿通過匯出閘門",
    });
    expect(
      dashboardEvaluatedBuildCopy({
        draftBuildCount: 8,
        evaluatedBuildCount: 5,
        readyBuildCount: 2,
      }),
    ).toEqual({
      english: "2 of the latest 5 drafts passed",
      zhHant: "最近 5 個草稿中有 2 個通過",
    });
  });

  it("covers empty, complete and incomplete readiness states", () => {
    expect(
      dashboardReadinessNoteCopy({
        activeCatalogueCount: 0,
        catalogueReadyCount: 0,
      }).english,
    ).toContain("Add a product first, then verify");
    expect(
      dashboardReadinessNoteCopy({
        activeCatalogueCount: 4,
        catalogueReadyCount: 4,
      }).english,
    ).toContain("All active catalogue items");
    expect(
      dashboardReadinessNoteCopy({
        activeCatalogueCount: 11,
        catalogueReadyCount: 6,
      }),
    ).toEqual({
      english: "5 catalogue records still need completion.",
      zhHant: "尚有 5 項目錄記錄需要補齊。",
    });
  });
});
