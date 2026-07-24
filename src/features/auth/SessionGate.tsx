import { AlertTriangle, LockKeyhole } from "lucide-react";
import type { ReactNode } from "react";

import { BrandMark } from "../../shared/components/BrandMark";
import { LoadingState } from "../../shared/components/AsyncState";
import { useSessionState } from "./session-context";
import "./auth.css";

export function SessionGate({ children }: { children: ReactNode }) {
  const state = useSessionState();

  if (state.status === "authenticated") {
    return children;
  }

  if (state.status === "loading") {
    return (
      <main className="auth-gate">
        <BrandMark />
        <LoadingState label="正在驗證商戶身份" />
      </main>
    );
  }

  const denied = state.status === "denied";

  return (
    <main className="auth-gate">
      <BrandMark />
      <section className="auth-gate__panel" role="alert">
        {denied ? (
          <LockKeyhole aria-hidden="true" />
        ) : (
          <AlertTriangle aria-hidden="true" />
        )}
        <div>
          <span className="auth-gate__eyebrow">
            {denied ? "Access required" : "Service unavailable"}
          </span>
          <h1>{denied ? "此帳戶未獲授權" : "暫時無法驗證身份"}</h1>
          <p>
            {denied
              ? "請使用已獲邀的 Cloudflare Access 帳戶，或聯絡工作空間管理員。"
              : "RigStage 未有載入任何商戶資料。請稍後再試。"}
          </p>
        </div>
        <button
          className="button button--secondary"
          type="button"
          onClick={state.reload}
        >
          重新驗證
        </button>
      </section>
    </main>
  );
}
