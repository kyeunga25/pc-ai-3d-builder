import type {
  WorkspaceActivityAction,
  WorkspaceActivityCategory,
} from "../../shared/domain/workspace-activity";
import { splitBilingualMessage } from "../../shared/i18n/locale";

export type WorkspaceActivityBilingualCopy = {
  readonly english: string;
  readonly zhHant: string;
};

export type WorkspaceActivityNotice = {
  readonly copy: WorkspaceActivityBilingualCopy;
  readonly tone: "error" | "info";
};

function copy(zhHant: string, english: string): WorkspaceActivityBilingualCopy {
  return { zhHant, english };
}

export const workspaceActivityInterfaceCopy = {
  eyebrow: copy("安全與營運", "Security and operations"),
  heading: copy("工作空間活動記錄", "Workspace activity log"),
  introduction: copy(
    "查看目前工作空間最近的關鍵狀態轉換。記錄不顯示電郵、私人目標 ID、request ID、物件位置或原始 metadata。",
    "Review recent meaningful state transitions in this workspace. The log does not display emails, private target IDs, request IDs, object locations, or raw metadata.",
  ),
  refresh: copy("重新載入", "Reload"),
  filter: copy("活動類別", "Activity category"),
  allCategories: copy("全部類別", "All categories"),
  latestHeading: copy("最近活動", "Recent activity"),
  loadedCount: copy("已載入記錄", "Loaded records"),
  actor: copy("執行者", "Actor"),
  systemActor: copy("系統流程", "System workflow"),
  loadOlder: copy("載入較早記錄", "Load older activity"),
  loadingOlder: copy("正在載入…", "Loading…"),
  noActivityHeading: copy("暫時沒有活動記錄", "No activity recorded yet"),
  noActivityBody: copy(
    "關鍵寫入操作成功後會在這裡顯示；讀取頁面不會建立新記錄。",
    "Successful meaningful write operations will appear here. Reading this page does not create a new event.",
  ),
  noFilteredHeading: copy("沒有符合篩選的活動", "No matching activity"),
  noFilteredBody: copy(
    "可選擇全部類別，或載入較早記錄後再查看。",
    "Choose all categories or load older activity and check again.",
  ),
  forbiddenHeading: copy("沒有活動記錄權限", "Activity log unavailable"),
  forbiddenBody: copy(
    "只有工作空間 owner 或 admin 可以查看受保護的活動記錄。",
    "Only workspace owners or admins can view the protected activity log.",
  ),
  invalidTime: copy("時間資料無效", "Invalid timestamp"),
} as const;

export const workspaceActivityCategoryCopy = {
  access: copy("存取與成員", "Access and members"),
  catalogue: copy("產品目錄", "Catalogue"),
  asset: copy("3D 素材", "3D assets"),
  build: copy("電腦組裝", "PC builds"),
  generation: copy("生成流程", "Generation workflow"),
  other: copy("其他受保護操作", "Other protected operation"),
} as const satisfies Record<
  WorkspaceActivityCategory,
  WorkspaceActivityBilingualCopy
>;

export const workspaceActivityActionCopy = {
  "workspace.member.invite": copy("建立成員邀請", "Member invitation created"),
  "workspace.member.update": copy("更新成員資格", "Membership updated"),
  "catalogue.part.create": copy("建立產品記錄", "Catalogue item created"),
  "catalogue.part.import": copy("匯入產品記錄", "Catalogue item imported"),
  "catalogue.part.update": copy("更新產品記錄", "Catalogue item updated"),
  "catalogue.part.archive": copy("封存產品記錄", "Catalogue item archived"),
  "asset.file.source.create": copy(
    "建立素材草稿及來源圖片",
    "Asset draft and source image created",
  ),
  "asset.file.source.upload": copy("上載來源圖片", "Source image uploaded"),
  "asset.file.source.remove": copy("移除來源圖片", "Source image removed"),
  "asset.file.model.upload": copy("上載私人 GLB", "Private GLB uploaded"),
  "asset.file.model.remove": copy("移除私人 GLB", "Private GLB removed"),
  "asset.review.save_draft": copy(
    "儲存素材審核草稿",
    "Asset review draft saved",
  ),
  "asset.review.approve": copy("核准 3D 素材", "3D asset approved"),
  "asset.review.reject": copy("拒絕 3D 素材", "3D asset rejected"),
  "build.create": copy("建立組裝草稿", "Build draft created"),
  "build.update": copy("更新組裝草稿", "Build draft updated"),
  "build.archive": copy("封存組裝草稿", "Build draft archived"),
  "generation.request": copy("要求建立 3D 草稿", "3D draft requested"),
  "generation.start.failed": copy(
    "生成流程未能啟動",
    "Generation failed to start",
  ),
  "generation.workflow.failed": copy(
    "生成流程失敗",
    "Generation workflow failed",
  ),
  "generation.draft.ready": copy(
    "生成草稿等待審核",
    "Generated draft awaiting review",
  ),
  other: copy("其他受保護操作", "Other protected operation"),
} as const satisfies Record<
  WorkspaceActivityAction,
  WorkspaceActivityBilingualCopy
>;

export const workspaceActivityNoticeCopy = {
  loadingOlder: {
    copy: copy("正在載入較早的活動記錄…", "Loading older activity…"),
    tone: "info",
  },
} as const satisfies Record<string, WorkspaceActivityNotice>;

export function workspaceActivityFailureNotice(
  error: unknown,
): WorkspaceActivityNotice {
  const fallback = copy(
    "無法載入活動記錄，請稍後重試。",
    "Unable to load the activity log. Try again later.",
  );
  const message =
    error instanceof Error
      ? splitBilingualMessage(error.message, fallback.english, fallback.zhHant)
      : fallback;
  return { copy: message, tone: "error" };
}

export function workspaceActivityTimeCopy(
  value: string,
): WorkspaceActivityBilingualCopy {
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/u.test(value)
    ? `${value.replace(" ", "T")}Z`
    : value;
  const date = new Date(normalized);
  if (!Number.isFinite(date.getTime())) {
    return workspaceActivityInterfaceCopy.invalidTime;
  }
  return copy(
    new Intl.DateTimeFormat("zh-HK", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Hong_Kong",
    }).format(date),
    new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Hong_Kong",
    }).format(date),
  );
}
