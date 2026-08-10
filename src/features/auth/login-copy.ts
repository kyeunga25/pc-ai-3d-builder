import type { LoginReason } from "./access-navigation";

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
