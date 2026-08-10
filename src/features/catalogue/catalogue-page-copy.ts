import type {
  CatalogPart,
  ComponentCategory,
} from "../../shared/domain/schemas";

export type CataloguePageCopy = {
  readonly english: string;
  readonly zhHant: string;
};

type CatalogueRowTone = "danger" | "info" | "neutral" | "success" | "warning";

function catalogueCopy(zhHant: string, english: string): CataloguePageCopy {
  return { english, zhHant };
}

export function bilingualCataloguePageTitle(copy: CataloguePageCopy): string {
  return `${copy.zhHant} / ${copy.english}`;
}

export const cataloguePageCopy = {
  actionsColumn: catalogueCopy("操作", "Actions"),
  addProduct: catalogueCopy("新增產品", "Add product"),
  addProductTitle: catalogueCopy("新增工作空間產品", "Add a workspace product"),
  allCategories: catalogueCopy("所有分類", "All categories"),
  assetColumn: catalogueCopy("3D 素材", "3D asset"),
  categoryColumn: catalogueCopy("分類", "Category"),
  categoryFilterLabel: catalogueCopy("組件分類", "Component category"),
  emptyCatalogueMessage: catalogueCopy(
    "使用「新增產品」或 CSV 匯入，建立這個工作空間的第一項產品。",
    "Use Add product or CSV import to create the first product in this workspace.",
  ),
  emptyCatalogueTitle: catalogueCopy(
    "產品目錄仍是空白",
    "The catalogue is empty",
  ),
  errorTitle: catalogueCopy(
    "無法載入工作空間產品目錄",
    "Unable to load the workspace catalogue",
  ),
  importCsv: catalogueCopy("匯入 CSV", "Import CSV"),
  importing: catalogueCopy("正在匯入…", "Importing…"),
  importTitle: catalogueCopy("匯入最多 50 項產品", "Import up to 50 products"),
  loadingLabel: catalogueCopy(
    "正在載入工作空間產品目錄",
    "Loading workspace catalogue",
  ),
  loadingMore: catalogueCopy("正在載入…", "Loading…"),
  loadMore: catalogueCopy("載入更多產品", "Load more products"),
  noMatchesMessage: catalogueCopy(
    "請嘗試其他 SKU、品牌或組件分類。",
    "Try another SKU, brand, or component category.",
  ),
  noMatchesTitle: catalogueCopy(
    "找不到相符的目錄組件",
    "No matching catalogue parts",
  ),
  pageEyebrow: catalogueCopy(
    "工作空間資料 · 人手核實狀態",
    "Workspace data · Human verification status",
  ),
  pageSummary: catalogueCopy(
    "在組件加入組裝方案前，先檢查庫存、規格及經人工核准的 3D 素材。",
    "Check stock, specifications and human-approved 3D assets before adding components to a build.",
  ),
  pageTitle: catalogueCopy("產品目錄", "Product catalogue"),
  priceColumn: catalogueCopy("售價", "Price"),
  productColumn: catalogueCopy("產品", "Product"),
  resultsLabel: catalogueCopy("產品目錄結果", "Catalogue results"),
  searchLabel: catalogueCopy("搜尋產品目錄", "Search catalogue"),
  searchPlaceholder: catalogueCopy(
    "搜尋 SKU、品牌或型號",
    "Search by SKU, brand, or model",
  ),
  showAllSpecifications: catalogueCopy(
    "顯示全部規格",
    "Show all specifications",
  ),
  stockColumn: catalogueCopy("庫存", "Stock"),
  template: catalogueCopy("CSV 範本", "Template"),
  toolbarLabel: catalogueCopy("產品目錄篩選器", "Catalogue filters"),
  verifiedOnly: catalogueCopy("只顯示已核實", "Verified specifications only"),
  view: catalogueCopy("查看", "View"),
  viewerOnlyTitle: catalogueCopy(
    "目前角色只可查看產品目錄",
    "The current role can only view the catalogue",
  ),
} as const satisfies Record<string, CataloguePageCopy>;

export const catalogueCategoryCopy = {
  case: catalogueCopy("機箱", "Case"),
  motherboard: catalogueCopy("主機板", "Motherboard"),
  cpu: catalogueCopy("處理器（CPU）", "Processor (CPU)"),
  gpu: catalogueCopy("顯示卡（GPU）", "Graphics card (GPU)"),
  memory: catalogueCopy("記憶體", "Memory"),
  cooling: catalogueCopy("散熱器", "Cooler"),
  storage: catalogueCopy("儲存裝置", "Storage"),
  psu: catalogueCopy("電源供應器（PSU）", "Power supply (PSU)"),
  fans: catalogueCopy("風扇", "Fans"),
} as const satisfies Record<ComponentCategory, CataloguePageCopy>;

export const catalogueStockStatusPresentation = {
  in_stock: {
    copy: catalogueCopy("有現貨", "In stock"),
    tone: "success",
  },
  low_stock: {
    copy: catalogueCopy("少量現貨", "Low stock"),
    tone: "warning",
  },
  out_of_stock: {
    copy: catalogueCopy("暫時缺貨", "Out of stock"),
    tone: "danger",
  },
  unknown: {
    copy: catalogueCopy("未確認", "Unconfirmed"),
    tone: "neutral",
  },
} as const satisfies Record<
  CatalogPart["stockStatus"],
  { readonly copy: CataloguePageCopy; readonly tone: CatalogueRowTone }
>;

export const catalogueAssetStatusPresentation = {
  approved: {
    copy: catalogueCopy("已核准", "Approved"),
    tone: "success",
  },
  needs_review: {
    copy: catalogueCopy("待審核", "Needs review"),
    tone: "warning",
  },
  draft: {
    copy: catalogueCopy("草稿", "Draft"),
    tone: "info",
  },
  proxy: {
    copy: catalogueCopy("替代模型", "Proxy model"),
    tone: "neutral",
  },
} as const satisfies Record<
  CatalogPart["assetStatus"],
  { readonly copy: CataloguePageCopy; readonly tone: CatalogueRowTone }
>;

export const catalogueAssetQualityCopy = {
  unreviewed: catalogueCopy("尚未評級", "Unrated"),
  draft: catalogueCopy("草稿品質", "Draft quality"),
  reviewed: catalogueCopy("已審核品質", "Reviewed quality"),
  approved: catalogueCopy("已核准品質", "Approved quality"),
} as const satisfies Record<CatalogPart["assetQuality"], CataloguePageCopy>;

export function catalogueStockCountCopy(
  stockCount: number | null,
): CataloguePageCopy {
  if (stockCount === null) {
    return catalogueCopy("數量尚未核實", "Stock count unverified");
  }
  return catalogueCopy(
    `${stockCount} 件`,
    `${stockCount} unit${stockCount === 1 ? "" : "s"}`,
  );
}

export function catalogueVerifiedFilterCopy(
  verifiedOnly: boolean,
): CataloguePageCopy {
  return verifiedOnly
    ? cataloguePageCopy.showAllSpecifications
    : cataloguePageCopy.verifiedOnly;
}

export function catalogueLoadMoreCopy(loading: boolean): CataloguePageCopy {
  return loading ? cataloguePageCopy.loadingMore : cataloguePageCopy.loadMore;
}

export function catalogueViewProductTitle(
  manufacturer: string,
  model: string,
): string {
  const productName = `${manufacturer} ${model}`;
  return `查看 ${productName} / View ${productName}`;
}
