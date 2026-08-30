import { AssetFileValidationError } from "../../shared/domain/asset-files";
import { splitBilingualMessage } from "../../shared/i18n/locale";
import { AssetReviewApiError } from "./asset-review-api";

export type BilingualCopy = {
  readonly english: string;
  readonly zhHant: string;
};

export type AssetReviewNoticeTone = "error" | "info" | "success" | "warning";

export type AssetReviewNotice = BilingualCopy & {
  readonly tone: AssetReviewNoticeTone;
};

type AssetReviewFailureOperation =
  | "approve"
  | "generation"
  | "generation-cancel"
  | "model-remove"
  | "model-upload"
  | "reject"
  | "save"
  | "source-remove"
  | "source-upload";

type ReviewAction = "approve" | "reject" | "save_draft";

export function bilingualCopy(zhHant: string, english: string): BilingualCopy {
  return { english, zhHant };
}

export function bilingualTitle(zhHant: string, english: string): string {
  return `${zhHant} / ${english}`;
}

export function assetReviewNotice(
  zhHant: string,
  english: string,
  tone: AssetReviewNoticeTone,
): AssetReviewNotice {
  return { english, tone, zhHant };
}

const failureCopy = {
  approve: bilingualCopy(
    "無法確認素材是否已核准；請重新載入素材狀態後再安全重試。",
    "Unable to confirm whether the asset was approved; reload the asset status before retrying safely.",
  ),
  generation: bilingualCopy(
    "無法確認模擬生成工作是否已建立；請重新載入工作狀態後再安全重試。系統未啟用供應商收費。",
    "Unable to confirm whether the simulated generation job was created; reload the job status before retrying safely. Provider billing is not enabled.",
  ),
  "generation-cancel": bilingualCopy(
    "無法確認排隊工作是否已取消；請重新載入工作狀態後再安全重試。不要假設 credit 已釋放。",
    "Unable to confirm whether the queued job was cancelled; reload the job status before retrying safely. Do not assume the credit was released.",
  ),
  "model-upload": bilingualCopy(
    "無法確認 GLB 是否已上載；請重新載入素材狀態後再安全重試。",
    "Unable to confirm whether the GLB was uploaded; reload the asset status before retrying safely.",
  ),
  "model-remove": bilingualCopy(
    "無法確認私人 GLB 是否已移除；請重新載入素材狀態後再安全重試。",
    "Unable to confirm whether the private GLB was removed; reload the asset status before retrying safely.",
  ),
  reject: bilingualCopy(
    "無法確認素材是否已拒絕；請重新載入素材狀態後再安全重試。",
    "Unable to confirm whether the asset was rejected; reload the asset status before retrying safely.",
  ),
  save: bilingualCopy(
    "無法確認審核草稿是否已儲存；請重新載入素材狀態後再安全重試。",
    "Unable to confirm whether the review draft was saved; reload the asset status before retrying safely.",
  ),
  "source-upload": bilingualCopy(
    "無法確認來源圖片是否已上載；請重新載入素材狀態後再安全重試。",
    "Unable to confirm whether the source image was uploaded; reload the asset status before retrying safely.",
  ),
  "source-remove": bilingualCopy(
    "無法確認所選來源圖片是否已移除；請重新載入素材狀態後再安全重試。",
    "Unable to confirm whether the selected source image was removed; reload the asset status before retrying safely.",
  ),
} as const satisfies Record<AssetReviewFailureOperation, BilingualCopy>;

export const assetReviewStatusCopy = {
  localUploadSession: assetReviewNotice(
    "私人上載預覽只保留在目前本地工作階段",
    "Private upload preview stays in this local session",
    "info",
  ),
  localSyntheticSession: assetReviewNotice(
    "合成資料變更只保留在本機",
    "Synthetic changes stay in this local session",
    "info",
  ),
  workspaceLoaded: assetReviewNotice(
    "已載入工作空間審核狀態",
    "Workspace review status loaded",
    "info",
  ),
  selectedLoaded: assetReviewNotice(
    "已載入指定素材",
    "Selected asset loaded",
    "info",
  ),
  queueEmpty: assetReviewNotice(
    "審核佇列目前沒有項目",
    "The asset review queue is empty",
    "info",
  ),
  queueItemChanged: assetReviewNotice(
    "已切換至另一項已載入素材",
    "Moved to another loaded asset",
    "info",
  ),
  queueLoadingMore: assetReviewNotice(
    "正在安全載入下一頁素材…",
    "Loading the next asset page safely…",
    "info",
  ),
  queuePageFailed: assetReviewNotice(
    "無法載入下一頁；目前素材及未送出的資料仍然保留，可安全重試",
    "Unable to load the next page. The current asset and unsent data remain available for a safe retry.",
    "error",
  ),
  generatedDraftValidated: assetReviewNotice(
    "模擬 GLB 草稿已通過格式驗證；必須重新完成人工審核",
    "The simulated GLB draft passed format validation. Complete the human review again.",
    "warning",
  ),
  generationPollFailed: assetReviewNotice(
    "暫時無法更新生成工作狀態；系統會自動重試",
    "Unable to refresh generation status. Automatic retry will continue.",
    "warning",
  ),
  localSourceCreated: assetReviewNotice(
    "本機合成 PNG 已建立；請明確確認使用權並儲存後再建立 3D 草稿",
    "A local synthetic PNG was created. Confirm usage rights and save before creating a 3D draft.",
    "warning",
  ),
  checklistDirty: assetReviewNotice(
    "核准清單有未儲存變更",
    "The approval checklist has unsaved changes",
    "warning",
  ),
  dimensionsDirty: assetReviewNotice(
    "核實尺寸有未儲存變更",
    "The verified dimensions have unsaved changes",
    "warning",
  ),
  confirmReject: assetReviewNotice(
    "再次按下「確認拒絕」才會標記此素材為已拒絕，並可能釋放保留 credit；不會刪除私人檔案。",
    "Press Confirm rejection again to mark this asset as rejected and possibly release reserved credit; private files will not be deleted.",
    "warning",
  ),
  confirmSourceRemoval: assetReviewNotice(
    "再次按下「確認移除圖片」才會刪除所選私人來源視角、重設核准證據，並可能釋放保留 credit；其他私人檔案不受影響。",
    "Press Confirm image removal again to delete the selected private source view, reset approval evidence, and possibly release reserved credit. Other private files are unchanged.",
    "warning",
  ),
  confirmModelRemoval: assetReviewNotice(
    "再次按下「確認移除 GLB」才會刪除私人模型、重設核准證據，並可能釋放保留 credit；所有來源圖片不受影響。",
    "Press Confirm GLB removal again to delete the private model, reset approval evidence, and possibly release reserved credit. All source images are unchanged.",
    "warning",
  ),
  confirmGenerationCancel: assetReviewNotice(
    "再次按下「確認取消工作」才會取消仍在排隊的工作並釋放保留 credit。若 Workflow 已開始，取消會失敗且不會停止處理。",
    "Press Confirm job cancellation again to cancel a still-queued job and release its reserved credit. If Workflow already started, cancellation fails and does not stop processing.",
    "warning",
  ),
  confirmationCanceled: assetReviewNotice(
    "確認已取消；未送出移除檔案、拒絕或取消排隊工作的操作",
    "Confirmation canceled. No file-removal, rejection or queued-job cancellation request was submitted.",
    "info",
  ),
  uploadingSource: assetReviewNotice(
    "正在驗證及上載來源圖片…",
    "Validating and uploading the source image…",
    "info",
  ),
  uploadingModel: assetReviewNotice(
    "正在驗證及上載 GLB…",
    "Validating and uploading the GLB…",
    "info",
  ),
  removingSource: assetReviewNotice(
    "正在移除所選私人來源圖片…",
    "Removing the selected private source image…",
    "info",
  ),
  removingModel: assetReviewNotice(
    "正在移除私人 GLB…",
    "Removing the private GLB…",
    "info",
  ),
  sourceUploaded: assetReviewNotice(
    "私人來源圖片已上載；核准清單已重設",
    "The private source image was uploaded. The approval checklist was reset.",
    "warning",
  ),
  modelUploaded: assetReviewNotice(
    "私人 GLB 已上載；請重新檢查方向、樞軸及尺寸",
    "The private GLB was uploaded. Recheck its orientation, pivot, and dimensions.",
    "warning",
  ),
  creatingGeneration: assetReviewNotice(
    "正在建立零成本模擬生成工作…",
    "Creating a zero-cost simulated generation job…",
    "info",
  ),
  cancelingGeneration: assetReviewNotice(
    "正在取消排隊中的生成工作…",
    "Cancelling the queued generation job…",
    "info",
  ),
  generationCancelled: assetReviewNotice(
    "排隊工作已取消；保留 credit 已釋放，未開始新的供應商嘗試",
    "The queued job was cancelled. Its reserved credit was released and no new provider attempt started.",
    "success",
  ),
  localGenerationCreated: assetReviewNotice(
    "本地模擬 GLB 已建立；核准證據已重設",
    "A local simulated GLB was created. Approval evidence was reset.",
    "warning",
  ),
  generationQueued: assetReviewNotice(
    "模擬生成工作已排入 Workflow；不會產生供應商費用",
    "The simulated job was queued in Workflow. No provider cost will be incurred.",
    "success",
  ),
  versionConflict: assetReviewNotice(
    "素材已被另一個審核動作更新，請重新載入",
    "The asset was updated by another review action. Reload before retrying.",
    "error",
  ),
  approveFailed: assetReviewNotice(
    failureCopy.approve.zhHant,
    failureCopy.approve.english,
    "error",
  ),
  generationFailed: assetReviewNotice(
    failureCopy.generation.zhHant,
    failureCopy.generation.english,
    "error",
  ),
  generationCancelFailed: assetReviewNotice(
    failureCopy["generation-cancel"].zhHant,
    failureCopy["generation-cancel"].english,
    "error",
  ),
  modelUploadFailed: assetReviewNotice(
    failureCopy["model-upload"].zhHant,
    failureCopy["model-upload"].english,
    "error",
  ),
  modelRemoveFailed: assetReviewNotice(
    failureCopy["model-remove"].zhHant,
    failureCopy["model-remove"].english,
    "error",
  ),
  rejectFailed: assetReviewNotice(
    failureCopy.reject.zhHant,
    failureCopy.reject.english,
    "error",
  ),
  saveFailed: assetReviewNotice(
    failureCopy.save.zhHant,
    failureCopy.save.english,
    "error",
  ),
  sourceUploadFailed: assetReviewNotice(
    failureCopy["source-upload"].zhHant,
    failureCopy["source-upload"].english,
    "error",
  ),
  sourceRemoveFailed: assetReviewNotice(
    failureCopy["source-remove"].zhHant,
    failureCopy["source-remove"].english,
    "error",
  ),
} as const;

export function assetReviewFileRemovedNotice(
  kind: "model" | "source",
  hadReservedGeneration: boolean,
): AssetReviewNotice {
  const creditZhHant = hadReservedGeneration ? "；已釋放保留 credit" : "";
  const creditEnglish = hadReservedGeneration
    ? " Reserved credit was released."
    : "";
  return kind === "source"
    ? assetReviewNotice(
        `所選私人來源圖片已移除${creditZhHant}；核准證據已重設`,
        `The selected private source image was removed.${creditEnglish} Approval evidence was reset.`,
        "success",
      )
    : assetReviewNotice(
        `私人 GLB 已移除${creditZhHant}；核准證據已重設`,
        `The private GLB was removed.${creditEnglish} Approval evidence was reset.`,
        "success",
      );
}

export function assetReviewRejectActionLabel(
  armed: boolean,
  submitting: boolean,
): BilingualCopy {
  if (submitting) {
    return bilingualCopy("拒絕中…", "Rejecting…");
  }
  if (armed) {
    return bilingualCopy("確認拒絕", "Confirm rejection");
  }
  return bilingualCopy("拒絕", "Reject");
}

export function nextAssetReviewRejectIntent(
  armedKey: string | null,
  currentKey: string,
): { nextArmedKey: string | null; shouldSubmit: boolean } {
  if (armedKey === currentKey) {
    return { nextArmedKey: null, shouldSubmit: true };
  }
  return { nextArmedKey: currentKey, shouldSubmit: false };
}

export function assetReviewQueueNotice(count: number): AssetReviewNotice {
  return assetReviewNotice(
    `已載入 ${count} 項審核素材`,
    `Loaded ${count} asset review item${count === 1 ? "" : "s"}`,
    "info",
  );
}

export function assetReviewQueuePageLoadedNotice(
  count: number,
): AssetReviewNotice {
  return assetReviewNotice(
    `已載入下一頁 ${count} 項素材`,
    `Loaded ${count} more asset review item${count === 1 ? "" : "s"}`,
    "success",
  );
}

export function assetReviewGenerationFailureNotice(
  failureCode: string,
): AssetReviewNotice {
  return assetReviewNotice(
    `模擬生成失敗：${failureCode}；請檢查素材後重試`,
    `Simulation failed: ${failureCode}. Review the asset and retry.`,
    "error",
  );
}

export function assetReviewSavingNotice(
  action: ReviewAction,
): AssetReviewNotice {
  if (action === "approve") {
    return assetReviewNotice("正在核准素材…", "Approving the asset…", "info");
  }
  if (action === "reject") {
    return assetReviewNotice("正在拒絕素材…", "Rejecting the asset…", "info");
  }
  return assetReviewNotice(
    "正在儲存審核草稿…",
    "Saving the review draft…",
    "info",
  );
}

export function assetReviewSavedNotice(
  action: ReviewAction,
  hadReservedGeneration: boolean,
): AssetReviewNotice {
  if (action === "approve") {
    return hadReservedGeneration
      ? assetReviewNotice(
          "素材已核准；已結算保留 credit 並記錄審核事件",
          "Asset approved. Reserved credit was settled and the review event was recorded.",
          "success",
        )
      : assetReviewNotice(
          "素材已核准並記錄審核事件",
          "Asset approved and the review event was recorded.",
          "success",
        );
  }
  if (action === "reject") {
    return hadReservedGeneration
      ? assetReviewNotice(
          "素材已拒絕；已釋放保留 credit 並記錄審核事件",
          "Asset rejected. Reserved credit was released and the review event was recorded.",
          "success",
        )
      : assetReviewNotice(
          "素材已拒絕並記錄審核事件",
          "Asset rejected and the review event was recorded.",
          "success",
        );
  }
  return assetReviewNotice(
    "審核草稿已儲存",
    "The review draft was saved.",
    "success",
  );
}

export function assetReviewErrorNotice(
  error: unknown,
  operation: AssetReviewFailureOperation,
): AssetReviewNotice {
  const fallback = failureCopy[operation];
  if (
    !(error instanceof AssetFileValidationError) &&
    !(error instanceof AssetReviewApiError)
  ) {
    return assetReviewNotice(fallback.zhHant, fallback.english, "error");
  }

  const copy = splitBilingualMessage(
    error.message,
    fallback.english,
    fallback.zhHant,
  );
  return assetReviewNotice(copy.zhHant, copy.english, "error");
}
