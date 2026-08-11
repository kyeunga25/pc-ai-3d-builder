import type { LoginReason } from "./access-navigation";

export type BilingualLoginCopy = {
  readonly english: string;
  readonly zhHant: string;
};

function loginCopy(zhHant: string, english: string): BilingualLoginCopy {
  return { english, zhHant };
}

export function bilingualLoginTitle(copy: BilingualLoginCopy): string {
  return `${copy.zhHant} / ${copy.english}`;
}

export const loginInterfaceCopy = {
  betaNote: loginCopy(
    "只接受獲邀的 Beta Access 用戶。商業使用或獨立部署，請聯絡工作空間管理員。",
    "Only invited Beta Access users are accepted. For commercial use or an independent deployment, contact the workspace administrator.",
  ),
  checkingSession: loginCopy(
    "正在檢查現有登入狀態",
    "Checking existing sign-in status",
  ),
  continueWithAccess: loginCopy(
    "使用 Cloudflare Access 繼續",
    "Continue with Cloudflare Access",
  ),
  destinationLabel: loginCopy("登入成功後前往", "After sign-in, go to"),
  failClosedBoundary: loginCopy(
    "失敗時不載入任何私人工作區資料",
    "No private workspace data loads when verification fails",
  ),
  footerAccess: loginCopy(
    "RigStage · Access 保護工作空間",
    "RigStage · Access-protected workspace",
  ),
  footerLocked: loginCopy(
    "驗證失敗時，私人資料保持鎖定",
    "Private data stays locked when verification fails",
  ),
  introDescription: loginCopy(
    "一次驗證後繼續管理產品目錄、私人 3D 素材與電腦組裝。這裡沒有公開註冊，也不會在登入前讀取商戶資料。",
    "Continue managing your product catalogue, private 3D assets and PC builds after one verification. There is no public registration, and no merchant data is read before sign-in.",
  ),
  introTitle: loginCopy(
    "登入你的 RigStage 工作空間。",
    "Sign in to your RigStage workspace.",
  ),
  inviteOnly: loginCopy("只限獲邀工作空間", "Invite-only workspace"),
  logoutCurrentIdentity: loginCopy(
    "先登出目前的 Access 身份",
    "Sign out of the current Access identity first",
  ),
  membershipBoundary: loginCopy(
    "伺服器再核對邀請與有效成員資格",
    "The server then checks the invitation and active membership",
  ),
  returnToPublicHome: loginCopy(
    "返回 RigStage 公開主頁",
    "Return to the RigStage public home page",
  ),
  securityBoundaryLabel: loginCopy("登入安全邊界", "Login security boundaries"),
  verifyIdentityBoundary: loginCopy(
    "Cloudflare Access 先驗證身份",
    "Cloudflare Access verifies identity first",
  ),
} as const satisfies Record<string, BilingualLoginCopy>;

export const loginReasonCopy = {
  "sign-in": {
    title: "準備安全登入",
    titleEnglish: "Ready to sign in securely",
    description:
      "使用已獲邀的 Cloudflare Access 身份繼續；登入成功後會返回相應的工作區區域。",
    descriptionEnglish:
      "Continue with an invited Cloudflare Access identity. No merchant data is loaded before sign-in; you will return to the requested workspace area afterward.",
    tone: "neutral",
  },
  "access-required": {
    title: "需要先驗證 Access 身份",
    titleEnglish: "Cloudflare Access verification required",
    description:
      "RigStage 尚未收到有效的 Cloudflare Access 登入憑證。請重新登入，再返回所需的工作區區域。",
    descriptionEnglish:
      "RigStage did not receive a valid Cloudflare Access login. No merchant data was loaded; sign in again to return to the requested workspace area.",
    tone: "warning",
  },
  "session-expired": {
    title: "登入時段已結束",
    titleEnglish: "Your session has ended",
    description:
      "為保護工作區，已停止載入商戶資料。重新驗證後會返回相應的工作區區域。",
    descriptionEnglish:
      "Merchant data loading stopped to protect the workspace. No further merchant data was loaded; verify again to return to the requested workspace area.",
    tone: "warning",
  },
  "not-authorized": {
    title: "此身份未獲工作區授權",
    titleEnglish: "This identity is not authorized",
    description:
      "這個 Access 身份未有有效邀請，或工作區成員資格已停用。網站沒有載入任何商戶資料。",
    descriptionEnglish:
      "This Access identity has no active invitation, or its workspace membership is disabled. No merchant data was loaded.",
    tone: "danger",
  },
  "service-unavailable": {
    title: "暫時無法完成身份檢查",
    titleEnglish: "Identity check is temporarily unavailable",
    description:
      "身份服務暫時沒有回應。工作區資料仍然保持鎖定，你可以稍後重新嘗試。",
    descriptionEnglish:
      "The identity service is not responding right now. No merchant data was loaded; workspace data remains locked while you try again later.",
    tone: "warning",
  },
} satisfies Record<
  LoginReason,
  {
    title: string;
    titleEnglish: string;
    description: string;
    descriptionEnglish: string;
    tone: "neutral" | "warning" | "danger";
  }
>;
