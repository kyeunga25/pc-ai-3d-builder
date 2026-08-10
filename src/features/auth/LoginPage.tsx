import {
  ArrowLeft,
  ArrowRight,
  CircleAlert,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";

import { BrandMark } from "../../shared/components/BrandMark";
import {
  safeWorkspaceLoginReturnPath,
  workspaceDestinationLabel,
} from "../../shared/domain/workspace-routes";
import { apiFetch } from "../../shared/lib/api-fetch";
import { isPublicDemoPath } from "../../shared/lib/demo-mode";
import {
  accessLogoutPath,
  parseLoginReason,
  type LoginReason,
} from "./access-navigation";
import { loginReasonCopy } from "./login-copy";
import "./auth.css";

function reasonFromStatus(status: number): LoginReason {
  if (status === 401) {
    return "access-required";
  }
  if (status === 403) {
    return "not-authorized";
  }
  return "service-unavailable";
}

export function LoginPage() {
  const [searchParams] = useSearchParams();
  const returnPath = safeWorkspaceLoginReturnPath(searchParams.get("next"));
  const queryReason = parseLoginReason(searchParams.get("reason"));
  const [detectedReason, setDetectedReason] = useState<LoginReason | null>(
    null,
  );
  const [checkingSession, setCheckingSession] = useState(
    !import.meta.env.DEV && !isPublicDemoPath(),
  );
  const reason = detectedReason ?? queryReason;
  const copy = loginReasonCopy[reason];
  const destination = workspaceDestinationLabel(returnPath);

  useEffect(() => {
    if (import.meta.env.DEV || isPublicDemoPath()) {
      return;
    }

    const controller = new AbortController();

    void apiFetch("/api/session", {
      headers: { accept: "application/json" },
      signal: controller.signal,
    })
      .then((response) => {
        if (response.ok) {
          window.location.replace(returnPath);
          return;
        }

        setDetectedReason(reasonFromStatus(response.status));
        setCheckingSession(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setDetectedReason("service-unavailable");
          setCheckingSession(false);
        }
      });

    return () => controller.abort();
  }, [returnPath]);

  const StatusIcon = copy.tone === "danger" ? CircleAlert : LockKeyhole;

  return (
    <div className="auth-page">
      <header className="auth-page__header">
        <Link to="/" aria-label="返回 RigStage 公開主頁">
          <BrandMark />
        </Link>
        <span>Invite-only workspace</span>
      </header>

      <main className="auth-page__main">
        <section className="auth-page__intro" aria-labelledby="login-title">
          <h1 id="login-title">登入你的 RigStage 工作空間。</h1>
          <p>
            一次驗證後繼續管理產品目錄、私人 3D
            素材與電腦組裝。這裡沒有公開註冊，也不會在登入前讀取商戶資料。
          </p>

          <ul aria-label="登入安全邊界">
            <li>
              <ShieldCheck aria-hidden="true" />
              <span>Cloudflare Access 先驗證身份</span>
            </li>
            <li>
              <KeyRound aria-hidden="true" />
              <span>伺服器再核對邀請與有效成員資格</span>
            </li>
            <li>
              <LockKeyhole aria-hidden="true" />
              <span>失敗時不載入任何私人工作區資料</span>
            </li>
          </ul>
        </section>

        <section className="auth-card" aria-labelledby="auth-status-title">
          <div
            className={`auth-card__status auth-card__status--${copy.tone}`}
            role={reason === "sign-in" ? "status" : "alert"}
          >
            <StatusIcon aria-hidden="true" />
            <div>
              <h2 id="auth-status-title">
                {copy.title}
                <small lang="en">{copy.titleEnglish}</small>
              </h2>
              <p>
                {copy.description}
                <span lang="en">{copy.descriptionEnglish}</span>
              </p>
            </div>
          </div>

          {checkingSession ? (
            <p className="auth-card__checking" role="status">
              <LoaderCircle aria-hidden="true" />
              <span>
                正在檢查現有登入狀態
                <small lang="en">Checking existing sign-in status</small>
              </span>
            </p>
          ) : null}

          <div className="auth-card__destination">
            <span>登入成功後前往</span>
            <strong>{destination}</strong>
          </div>

          <a
            className="button button--primary auth-card__primary"
            href={returnPath}
          >
            <span>使用 Cloudflare Access 繼續</span>
            <ArrowRight aria-hidden="true" />
          </a>

          {reason === "not-authorized" ? (
            <a className="auth-card__logout" href={accessLogoutPath}>
              先登出目前的 Access 身份
            </a>
          ) : null}

          <p className="auth-card__note">
            只接受獲邀的 Beta Access
            用戶。商業使用或獨立部署，請聯絡工作空間管理員。
          </p>

          <Link className="auth-card__back" to="/">
            <ArrowLeft aria-hidden="true" />
            返回公開主頁
          </Link>
        </section>
      </main>

      <footer className="auth-page__footer">
        <span>RigStage · Access-protected workspace</span>
        <span>驗證失敗時，私人資料保持鎖定</span>
      </footer>
    </div>
  );
}
