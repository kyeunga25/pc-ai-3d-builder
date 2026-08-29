import type { WorkspaceRole } from "../../shared/domain/session";
import type {
  WorkspaceMemberIdentityState,
  WorkspaceMemberStatus,
} from "../../shared/domain/workspace-members";
import { splitBilingualMessage } from "../../shared/i18n/locale";

export type WorkspaceMemberBilingualCopy = {
  readonly english: string;
  readonly zhHant: string;
};

export type WorkspaceMemberNotice = {
  readonly copy: WorkspaceMemberBilingualCopy;
  readonly tone: "error" | "info" | "success" | "warning";
};

function copy(zhHant: string, english: string): WorkspaceMemberBilingualCopy {
  return { zhHant, english };
}

export const workspaceMemberInterfaceCopy = {
  eyebrow: copy("存取與成員", "Access and members"),
  heading: copy("工作空間成員管理", "Workspace member management"),
  introduction: copy(
    "邀請已獲授權的人員，並以最小權限管理目前工作空間。Cloudflare Access 身份仍須在首次登入時由伺服器驗證及綁定。",
    "Invite authorized people and manage this workspace with least privilege. Cloudflare Access identity is still verified and bound by the server at first sign-in.",
  ),
  inviteHeading: copy("邀請成員", "Invite a member"),
  inviteGuidance: copy(
    "電郵只會儲存在受保護的身份資料及目前工作空間成員資格；不會加入 URL、公開資產或一般 request log。此操作不會修改 Cloudflare Access policy，部署管理員仍須把同一電郵加入精確 Allow 名單。",
    "The email is stored only in protected identity data and this workspace membership; it is not added to URLs, public assets, or standard request logs. This does not change the Cloudflare Access policy; a deployment admin must still add the same email to the exact Allow list.",
  ),
  email: copy("獲邀電郵", "Invitee email"),
  displayName: copy("顯示名稱", "Display name"),
  role: copy("角色", "Role"),
  inviteAction: copy("建立 D1 邀請", "Create D1 invitation"),
  invitingAction: copy("正在邀請…", "Inviting…"),
  directoryHeading: copy("目前成員", "Current members"),
  directoryGuidance: copy(
    "owner 可管理所有非本人角色；admin 只可管理 staff 與 viewer。自己的角色及資格須由另一位 owner 管理。",
    "Owners can manage every role except themselves. Admins can manage only staff and viewers. Another owner must manage your own role and membership.",
  ),
  currentUser: copy("目前帳戶", "Current account"),
  saveRole: copy("儲存角色", "Save role"),
  saving: copy("正在儲存…", "Saving…"),
  suspend: copy("停用成員", "Suspend member"),
  confirmSuspend: copy("確認停用", "Confirm suspension"),
  reactivate: copy("重新啟用", "Reactivate"),
  selfManagedElsewhere: copy(
    "自己的角色及狀態不可在此修改。",
    "Your own role and status cannot be changed here.",
  ),
  restrictedTarget: copy(
    "目前角色不可管理此成員。",
    "Your current role cannot manage this member.",
  ),
  truncated: copy(
    "工作空間成員超過 100 位；目前只顯示首 100 位，請使用更窄的營運流程處理其餘成員。",
    "This workspace has more than 100 members. Only the first 100 are shown; use a narrower operational process for the remainder.",
  ),
  forbiddenHeading: copy("沒有成員管理權限", "Member management unavailable"),
  forbiddenBody: copy(
    "只有工作空間 owner 或 admin 可以查看受保護的成員名單。",
    "Only workspace owners or admins can view the protected member directory.",
  ),
} as const;

export const workspaceMemberRoleCopy = {
  owner: copy("擁有人", "Owner"),
  admin: copy("管理員", "Admin"),
  staff: copy("職員", "Staff"),
  viewer: copy("檢視者", "Viewer"),
} as const satisfies Record<WorkspaceRole, WorkspaceMemberBilingualCopy>;

export const workspaceMemberStatusCopy = {
  active: copy("有效資格", "Active membership"),
  suspended: copy("已停用", "Suspended"),
} as const satisfies Record<
  WorkspaceMemberStatus,
  WorkspaceMemberBilingualCopy
>;

export const workspaceMemberIdentityCopy = {
  pending: copy("等待首次驗證", "Awaiting first verification"),
  bound: copy("Access 身份已綁定", "Access identity bound"),
  blocked: copy("帳戶由安全管理停用", "Account blocked by security admin"),
} as const satisfies Record<
  WorkspaceMemberIdentityState,
  WorkspaceMemberBilingualCopy
>;

export const workspaceMemberNoticeCopy = {
  loading: {
    copy: copy(
      "正在載入受保護的成員名單。",
      "Loading the protected member directory.",
    ),
    tone: "info",
  },
  invitePending: {
    copy: copy(
      "正在建立邀請及成員資格…",
      "Creating the invitation and membership…",
    ),
    tone: "info",
  },
  inviteSuccessPending: {
    copy: copy(
      "D1 邀請已建立；部署管理員加入精確 Access Allow 電郵後，等待對方首次驗證。",
      "The D1 invitation is ready. After a deployment admin adds the exact Access Allow email, it will await the invitee's first verification.",
    ),
    tone: "success",
  },
  inviteSuccessBound: {
    copy: copy(
      "已驗證身份的工作空間資格已建立；請確認該電郵仍在精確 Access Allow 名單內。",
      "Workspace membership is ready for the verified identity. Confirm that its email remains on the exact Access Allow list.",
    ),
    tone: "success",
  },
  updatePending: {
    copy: copy("正在保存成員資格…", "Saving the membership…"),
    tone: "info",
  },
  updateSuccess: {
    copy: copy("成員資格已更新。", "Membership updated."),
    tone: "success",
  },
  confirmSuspend: {
    copy: copy(
      "再次按下確認停用；此操作不會刪除帳戶或工作空間資料。",
      "Press Confirm suspension again. This does not delete the account or workspace data.",
    ),
    tone: "warning",
  },
} as const satisfies Record<string, WorkspaceMemberNotice>;

const operationFallback = {
  load: copy(
    "無法載入成員名單，請稍後重試。",
    "Unable to load the member directory. Try again later.",
  ),
  invite: copy(
    "無法確認邀請結果；請重新載入成員名單後再安全重試。",
    "Unable to confirm the invitation result. Reload the member directory before retrying safely.",
  ),
  update: copy(
    "無法確認成員更新結果；請重新載入成員名單後再安全重試。",
    "Unable to confirm the membership update. Reload the member directory before retrying safely.",
  ),
} as const;

export function workspaceMemberFailureNotice(
  error: unknown,
  operation: keyof typeof operationFallback,
): WorkspaceMemberNotice {
  const fallback = operationFallback[operation];
  const message =
    error instanceof Error
      ? splitBilingualMessage(error.message, fallback.english, fallback.zhHant)
      : fallback;
  return { copy: message, tone: "error" };
}
