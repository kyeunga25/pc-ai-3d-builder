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
  | "model-upload"
  | "reject"
  | "save"
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
  "model-upload": bilingualCopy(
    "無法確認 GLB 是否已上載；請重新載入素材狀態後再安全重試。",
    "Unable to confirm whether the GLB was uploaded; reload the asset status before retrying safely.",
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
  modelUploadFailed: assetReviewNotice(
    failureCopy["model-upload"].zhHant,
    failureCopy["model-upload"].english,
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
} as const;

export function assetReviewQueueNotice(count: number): AssetReviewNotice {
  return assetReviewNotice(
    `審核佇列共有 ${count} 項素材`,
    `Asset review queue has ${count} item${count === 1 ? "" : "s"}`,
    "info",
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
