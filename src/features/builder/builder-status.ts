import { splitBilingualMessage } from "../../shared/i18n/locale";

type BuilderOperation = "archive" | "create" | "export" | "save" | "switch";

type BilingualCopy = {
  english: string;
  zhHant: string;
};

export type BuilderStatusTone = "error" | "info" | "success" | "warning";

export type BuilderOperationStatus = {
  readonly message: string;
  readonly tone: BuilderStatusTone;
};

function bilingual({ zhHant, english }: BilingualCopy): string {
  return `${zhHant} / ${english}`;
}

function status(
  message: string,
  tone: BuilderStatusTone,
): BuilderOperationStatus {
  return { message, tone };
}

const failureCopy = {
  archive: {
    zhHant: "無法封存組裝；資料未有變更。",
    english: "Unable to archive the build; no data was changed.",
  },
  create: {
    zhHant: "無法建立新組裝；資料未有變更。",
    english: "Unable to create a new build; no data was changed.",
  },
  export: {
    zhHant: "無法匯出組裝；沒有建立下載檔案。",
    english: "Unable to export the build; no download file was created.",
  },
  save: {
    zhHant: "無法儲存組裝；資料未有變更。",
    english: "Unable to save the build; no data was changed.",
  },
  switch: {
    zhHant: "無法切換組裝；目前組裝維持不變。",
    english: "Unable to switch builds; the current build is unchanged.",
  },
} as const satisfies Record<BuilderOperation, BilingualCopy>;

export const builderStatusCopy = {
  localApprovedLoaded: status(
    "已載入剛核准的本機合成 GLB。 / The newly approved local synthetic GLB is loaded.",
    "success",
  ),
  localBuildLoaded: status(
    "本地合成組裝已載入。 / The local synthetic build is loaded.",
    "success",
  ),
  loading: status("正在載入組裝。 / Loading builds.", "info"),
  emptyRead: status(
    "目前沒有組裝；讀取沒有建立新資料。 / There are no builds; this read did not create data.",
    "info",
  ),
  partSelectionDirty: status(
    "產品選擇有未儲存變更。 / The product selection has unsaved changes.",
    "warning",
  ),
  buildNameDirty: status(
    "組裝名稱有未儲存變更。 / The build name has unsaved changes.",
    "warning",
  ),
  saveBeforeCreate: status(
    "請先儲存目前組裝，再建立新組裝。 / Save the current build before creating another one.",
    "warning",
  ),
  creating: status("正在建立新組裝… / Creating a new build…", "info"),
  localCreated: status(
    "本地新組裝已建立。 / A new local build was created.",
    "success",
  ),
  created: status(
    "新組裝草稿已建立。 / A new build draft was created.",
    "success",
  ),
  saveBeforeSwitch: status(
    "請先儲存目前組裝，再切換另一個組裝。 / Save the current build before switching to another one.",
    "warning",
  ),
  switching: status("正在切換組裝… / Switching builds…", "info"),
  saving: status("正在儲存組裝… / Saving the build…", "info"),
  saveBeforeArchive: status(
    "請先儲存目前變更，再封存組裝。 / Save the current changes before archiving the build.",
    "warning",
  ),
  confirmArchive: status(
    "再次按下封存按鈕以確認；資料不會被永久刪除。 / Press Archive again to confirm; the data will not be permanently deleted.",
    "warning",
  ),
  archiving: status("正在封存組裝… / Archiving the build…", "info"),
  exporting: status(
    "正在準備安全匯出… / Preparing the privacy-safe export…",
    "info",
  ),
  exported: status(
    "已匯出；檔案不含身份、工作空間識別資料、價格、庫存或私人素材。 / Exported; the file excludes identity, workspace identifiers, pricing, stock and private assets.",
    "success",
  ),
  versionConflict: status(
    "組裝版本已改變，請重新載入。 / The build version changed. Reload before retrying.",
    "error",
  ),
  createFailed: status(bilingual(failureCopy.create), "error"),
  switchFailed: status(bilingual(failureCopy.switch), "error"),
  saveFailed: status(bilingual(failureCopy.save), "error"),
  archiveFailed: status(bilingual(failureCopy.archive), "error"),
  exportFailed: status(bilingual(failureCopy.export), "error"),
} as const;

export function builderLoadedStatus(version: number): BuilderOperationStatus {
  return status(
    `已載入版本 ${version}。 / Version ${version} is loaded.`,
    "success",
  );
}

export function builderSavedStatus(
  version: number,
  isLocalPreview: boolean,
): BuilderOperationStatus {
  return status(
    isLocalPreview
      ? `本地版本 ${version} 已儲存。 / Local version ${version} is saved.`
      : `D1 版本 ${version} 已儲存。 / D1 version ${version} is saved.`,
    "success",
  );
}

export function builderArchivedStatus(
  nextVersion: number | null,
): BuilderOperationStatus {
  return status(
    nextVersion === null
      ? "組裝已封存；目前沒有其他草稿。 / The build was archived; there are no other drafts."
      : `已封存上一個組裝；已載入版本 ${nextVersion}。 / The previous build was archived; version ${nextVersion} is loaded.`,
    "success",
  );
}

export function builderFailureStatus(
  error: unknown,
  operation: BuilderOperation,
): BuilderOperationStatus {
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
