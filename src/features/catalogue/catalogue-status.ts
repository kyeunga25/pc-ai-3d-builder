import { splitBilingualMessage } from "../../shared/i18n/locale";

type CatalogueOperation = "archive" | "asset-draft" | "import" | "save";

type BilingualCopy = {
  english: string;
  zhHant: string;
};

export type CatalogueStatusTone = "error" | "info" | "success" | "warning";

export type CatalogueOperationStatus = {
  readonly message: string;
  readonly tone: CatalogueStatusTone;
};

function bilingual({ zhHant, english }: BilingualCopy): string {
  return `${zhHant} / ${english}`;
}

function status(
  message: string,
  tone: CatalogueStatusTone,
): CatalogueOperationStatus {
  return { message, tone };
}

const failureCopy = {
  archive: {
    zhHant: "無法確認產品是否已封存；請重新載入目錄後再安全重試。",
    english:
      "Unable to confirm whether the product was archived; reload the catalogue before retrying safely.",
  },
  "asset-draft": {
    zhHant: "無法確認素材草稿是否已建立；請重新載入產品後再安全重試。",
    english:
      "Unable to confirm whether the asset draft was created; reload the product before retrying safely.",
  },
  import: {
    zhHant: "無法確認 CSV 匯入結果；請重新載入目錄後再安全重試。",
    english:
      "Unable to confirm the CSV import result; reload the catalogue before retrying safely.",
  },
  save: {
    zhHant: "無法確認產品是否已儲存；請重新載入目錄後再安全重試。",
    english:
      "Unable to confirm whether the product was saved; reload the catalogue before retrying safely.",
  },
} as const satisfies Record<CatalogueOperation, BilingualCopy>;

export const catalogueStatusCopy = {
  loading: status(
    "正在讀取工作空間目錄。 / Loading the workspace catalogue.",
    "info",
  ),
  loadingMore: status(
    "正在載入更多工作空間產品。 / Loading more workspace products.",
    "info",
  ),
  loadMoreFailed: status(
    "未能載入更多產品；現有清單維持不變。 / Unable to load more products; the existing list is unchanged.",
    "error",
  ),
  validatingImport: status(
    "正在驗證 CSV 及工作空間資料。 / Validating the CSV and workspace data.",
    "info",
  ),
  saving: status("正在儲存產品… / Saving the product…", "info"),
  archiving: status("正在封存產品… / Archiving the product…", "info"),
  creatingAssetDraft: status(
    "正在建立私人素材草稿… / Creating the private asset draft…",
    "info",
  ),
  templateDownloadStarted: status(
    "不含真實資料的 CSV 範本已開始下載。 / The synthetic-data-only CSV template download has started.",
    "success",
  ),
  confirmArchive: status(
    "再次按下「確認封存」即可從目前目錄隱藏此產品；資料不會被永久刪除。 / Press Confirm archive again to hide this product from the current catalogue; the data will not be permanently deleted.",
    "warning",
  ),
  invalidFields: status(
    "請檢查必填欄位、港幣售價、庫存數量及規格 JSON。 / Check the required fields, HKD price, stock quantity and specification JSON.",
    "error",
  ),
  readOnly: status(
    "目前角色是唯讀；資料不會被修改。 / The current role is read-only; data will not be changed.",
    "info",
  ),
  writeBoundary: status(
    "儲存後只會更新目前已驗證的工作空間，並留下精簡操作紀錄。 / Only the currently verified workspace will be updated, with a minimal operation record.",
    "info",
  ),
  archiveFailed: status(bilingual(failureCopy.archive), "error"),
  assetDraftFailed: status(bilingual(failureCopy["asset-draft"]), "error"),
  importFailed: status(bilingual(failureCopy.import), "error"),
  saveFailed: status(bilingual(failureCopy.save), "error"),
} as const;

export function catalogueCountStatus(
  count: number,
  isLocalPreview: boolean,
): CatalogueOperationStatus {
  return status(
    isLocalPreview
      ? `${count} 件產品 / ${count} products · 合成示範資料 / Synthetic demo data`
      : `${count} 件工作空間產品 / ${count} workspace products`,
    "info",
  );
}

export function catalogueCreatedStatus(sku: string): CatalogueOperationStatus {
  return status(`已新增 ${sku} / Added ${sku}`, "success");
}

export function catalogueUpdatedStatus(sku: string): CatalogueOperationStatus {
  return status(`已更新 ${sku} / Updated ${sku}`, "success");
}

export function catalogueArchivedStatus(sku: string): CatalogueOperationStatus {
  return status(`已封存 ${sku} / Archived ${sku}`, "success");
}

export function catalogueImportedStatus(
  count: number,
): CatalogueOperationStatus {
  return status(
    `已匯入 ${count} 件產品 / Imported ${count} products`,
    "success",
  );
}

export function catalogueFailureStatus(
  error: unknown,
  operation: CatalogueOperation,
): CatalogueOperationStatus {
  const fallback = failureCopy[operation];
  if (!(error instanceof Error)) {
    return status(bilingual(fallback), "error");
  }
  return status(
    bilingual(
      splitBilingualMessage(error.message, fallback.english, fallback.zhHant),
    ),
    "error",
  );
}
