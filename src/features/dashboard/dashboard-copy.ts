export type DashboardBilingualCopy = {
  readonly english: string;
  readonly zhHant: string;
};

function bilingualCopy(
  zhHant: string,
  english: string,
): DashboardBilingualCopy {
  return { english, zhHant };
}

function englishCount(value: number, singular: string): string {
  return `${value} ${singular}${value === 1 ? "" : "s"}`;
}

export const dashboardInterfaceCopy = {
  syntheticDemoData: bilingualCopy("合成示範資料", "Synthetic demo data"),
  heading: bilingualCopy("商戶儀表板", "Merchant dashboard"),
  introduction: bilingualCopy(
    "集中查看產品目錄準備度、待審工作及進行中的電腦組裝。",
    "Review catalogue readiness, pending work and active PC builds in one place.",
  ),
  addCatalogueProduct: bilingualCopy("新增目錄產品", "Add catalogue product"),
  openBuilder: bilingualCopy("開啟組裝工具", "Open PC Builder"),
  workspaceMetrics: bilingualCopy("工作空間即時指標", "Live workspace metrics"),
  catalogueComponents: bilingualCopy("目錄組件", "Catalogue components"),
  pendingAssetReview: bilingualCopy("等待素材審核", "Awaiting asset review"),
  safeToExport: bilingualCopy("可安全匯出", "Safe to export"),
  buildDrafts: bilingualCopy("組裝草稿", "Build drafts"),
  recentWork: bilingualCopy("最近工作", "Recent work"),
  recentWorkSubtitle: bilingualCopy(
    "此工作空間需要處理的項目。",
    "Items in this workspace that need attention.",
  ),
  openAssetReview: bilingualCopy(
    "開啟 3D 素材審核工作室",
    "Open 3D Asset Review",
  ),
  dataReadiness: bilingualCopy("資料準備度", "Data readiness"),
  readinessSubtitle: bilingualCopy(
    "規格已核實並有核准素材的比例。",
    "Share of items with verified specifications and approved assets.",
  ),
  verifiedSpecifications: bilingualCopy(
    "規格已核實",
    "Specifications verified",
  ),
  approvedAssets: bilingualCopy("素材已核准", "Assets approved"),
  evaluatedBuilds: bilingualCopy("最近評估組裝", "Recently evaluated builds"),
} as const satisfies Record<string, DashboardBilingualCopy>;

function englishUnit(value: number, singular: string): string {
  return `${value} ${singular}${value === 1 ? "" : "s"} ago`;
}

export function relativeDashboardUpdateCopy(
  value: string,
  now = Date.now(),
): DashboardBilingualCopy {
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/u.test(value)
    ? `${value.replace(" ", "T")}Z`
    : value;
  const timestamp = Date.parse(normalized);
  if (!Number.isFinite(timestamp)) {
    return bilingualCopy("最近更新", "Recently updated");
  }

  const minutes = Math.max(0, Math.floor((now - timestamp) / 60_000));
  if (minutes < 1) {
    return bilingualCopy("剛剛", "Just now");
  }
  if (minutes < 60) {
    return bilingualCopy(`${minutes} 分鐘前`, englishUnit(minutes, "minute"));
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return bilingualCopy(`${hours} 小時前`, englishUnit(hours, "hour"));
  }

  const days = Math.floor(hours / 24);
  return days <= 7
    ? bilingualCopy(`${days} 日前`, englishUnit(days, "day"))
    : bilingualCopy("較早更新", "Earlier update");
}

export function dashboardVerifiedCatalogueCopy(
  count: number,
): DashboardBilingualCopy {
  return bilingualCopy(
    `${count} 項規格已核實`,
    `${englishCount(count, "specification")} verified`,
  );
}

export function dashboardApprovedAssetCopy(
  count: number,
): DashboardBilingualCopy {
  return bilingualCopy(
    `${count} 項素材已核准`,
    `${englishCount(count, "asset")} approved`,
  );
}

export function dashboardAttentionBuildCopy(
  count: number,
): DashboardBilingualCopy {
  return bilingualCopy(
    `${count} 個最近草稿需要處理`,
    `${englishCount(count, "recent draft")} ${count === 1 ? "needs" : "need"} attention`,
  );
}

export function dashboardWorkCountCopy(count: number): DashboardBilingualCopy {
  return bilingualCopy(`${count} 項`, englishCount(count, "item"));
}

export function dashboardUsableCatalogueCopy(
  count: number,
): DashboardBilingualCopy {
  return bilingualCopy(
    `${count} 項可使用`,
    `${englishCount(count, "item")} usable`,
  );
}

export function dashboardEvaluatedBuildCopy({
  draftBuildCount,
  evaluatedBuildCount,
  readyBuildCount,
}: {
  draftBuildCount: number;
  evaluatedBuildCount: number;
  readyBuildCount: number;
}): DashboardBilingualCopy {
  return evaluatedBuildCount === draftBuildCount
    ? bilingualCopy(
        `${readyBuildCount} 個草稿通過匯出閘門`,
        `${englishCount(readyBuildCount, "draft")} passed the export gate`,
      )
    : bilingualCopy(
        `最近 ${evaluatedBuildCount} 個草稿中有 ${readyBuildCount} 個通過`,
        `${readyBuildCount} of the latest ${evaluatedBuildCount} drafts passed`,
      );
}

export function dashboardReadinessNoteCopy({
  activeCatalogueCount,
  catalogueReadyCount,
}: {
  activeCatalogueCount: number;
  catalogueReadyCount: number;
}): DashboardBilingualCopy {
  if (activeCatalogueCount === 0) {
    return bilingualCopy(
      "先新增產品，再核實規格及完成素材審批。",
      "Add a product first, then verify its specifications and approve its asset.",
    );
  }
  if (activeCatalogueCount === catalogueReadyCount) {
    return bilingualCopy(
      "所有現行目錄項目均具備已核實規格及核准素材。",
      "All active catalogue items have verified specifications and approved assets.",
    );
  }
  const missingCount = activeCatalogueCount - catalogueReadyCount;
  return bilingualCopy(
    `尚有 ${missingCount} 項目錄記錄需要補齊。`,
    `${englishCount(missingCount, "catalogue record")} still ${missingCount === 1 ? "needs" : "need"} completion.`,
  );
}

export function dashboardReadinessAriaCopy(
  readiness: number,
): DashboardBilingualCopy {
  return bilingualCopy(
    `目錄資料準備度百分之${readiness}`,
    `Catalogue data readiness: ${readiness}%`,
  );
}
