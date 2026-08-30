import type {
  GenerationCapability,
  GenerationCreditSummary,
  GenerationEntitlementStatus,
  GenerationJob,
  GenerationJobStatus,
} from "../../shared/domain/generation-jobs";
import { bilingualCopy, type BilingualCopy } from "./asset-review-status";

export const generationInspectorCopy = {
  heading: bilingualCopy("生成工作", "Generation job"),
  description: bilingualCopy(
    "只顯示中立狀態，不公開供應商或私人物件資料",
    "Shows neutral status only; provider and private object data stay hidden",
  ),
  executionMode: bilingualCopy("執行模式", "Execution mode"),
  latestStatus: bilingualCopy("最新狀態", "Latest status"),
  noJob: bilingualCopy("尚未有工作", "No job yet"),
  credit: bilingualCopy("非貨幣 Credit", "Non-monetary credit"),
  cumulativeCredit: bilingualCopy("累計 Credit", "Cumulative credit"),
  entitlementStatus: bilingualCopy("權益狀態", "Entitlement status"),
  notApplicable: bilingualCopy("不適用", "Not applicable"),
  simulationCostUnits: bilingualCopy("模擬成本單位", "Simulation cost units"),
  noCostRecorded: bilingualCopy("尚未記錄", "Not recorded yet"),
  glbValidation: bilingualCopy("GLB 驗證", "GLB validation"),
  notValidated: bilingualCopy("尚未驗證", "Not validated yet"),
  explanation: bilingualCopy(
    "模擬輸出仍是草稿，格式驗證通過後亦須重新核對身份、方向、尺寸、樞軸及使用權。Credit 只代表非貨幣測試權益。",
    "Simulated output remains a draft. Recheck identity, orientation, dimensions, pivot and usage rights after format validation. Credit represents non-monetary test entitlement only.",
  ),
} as const satisfies Record<string, BilingualCopy>;

export const generationJobStatusCopy = {
  queued: bilingualCopy("已排入佇列", "Queued"),
  running: bilingualCopy("正在建立草稿", "Creating draft"),
  validating: bilingualCopy("正在驗證 GLB", "Validating GLB"),
  awaiting_review: bilingualCopy("等待人工審核", "Awaiting human review"),
  failed: bilingualCopy("工作失敗", "Job failed"),
  cancelled: bilingualCopy("工作已取消", "Job cancelled"),
} as const satisfies Record<GenerationJobStatus, BilingualCopy>;

export const generationEntitlementStatusCopy = {
  reserved: bilingualCopy(
    "已保留，等待人工決定",
    "Reserved, awaiting human decision",
  ),
  settled: bilingualCopy("已結算", "Settled"),
  released: bilingualCopy("已釋放", "Released"),
} as const satisfies Record<GenerationEntitlementStatus, BilingualCopy>;

export const generationModeCopy = {
  disabled: bilingualCopy("未啟用", "Disabled"),
  simulation: bilingualCopy("零成本模擬", "Zero-cost simulation"),
} as const satisfies Record<GenerationCapability["mode"], BilingualCopy>;

export function assetReviewGenerationModeCopy(
  mode: GenerationCapability["mode"],
): BilingualCopy {
  return generationModeCopy[mode];
}

export function assetReviewGenerationStatusCopy(
  job: GenerationJob,
): BilingualCopy {
  if (job.status === "awaiting_review" && job.entitlementStatus === "settled") {
    return bilingualCopy("人工審核已核准", "Human review approved");
  }
  return generationJobStatusCopy[job.status];
}

export function assetReviewGenerationEntitlementCopy(
  status: GenerationEntitlementStatus,
): BilingualCopy {
  return generationEntitlementStatusCopy[status];
}

export function assetReviewGenerationCreditSummaryCopy(
  credits: GenerationCreditSummary,
): BilingualCopy {
  return bilingualCopy(
    `${credits.availableUnits} 可用 · ${credits.reservedUnits} 保留`,
    `${credits.availableUnits} available · ${credits.reservedUnits} reserved`,
  );
}

export function assetReviewGenerationCreditHistoryCopy(
  credits: GenerationCreditSummary,
): BilingualCopy {
  return bilingualCopy(
    `${credits.settledUnits} 結算 · ${credits.releasedUnits} 釋放`,
    `${credits.settledUnits} settled · ${credits.releasedUnits} released`,
  );
}

export function assetReviewGenerationCancelActionCopy(
  armed: boolean,
  cancelling: boolean,
): BilingualCopy {
  if (cancelling) {
    return bilingualCopy("取消中…", "Cancelling…");
  }
  return armed
    ? bilingualCopy("確認取消工作", "Confirm job cancellation")
    : bilingualCopy("取消排隊工作", "Cancel queued job");
}

export function nextAssetReviewGenerationCancelIntent(
  armedKey: string | null,
  currentKey: string,
): { nextArmedKey: string | null; shouldSubmit: boolean } {
  if (armedKey === currentKey) {
    return { nextArmedKey: null, shouldSubmit: true };
  }
  return { nextArmedKey: currentKey, shouldSubmit: false };
}
