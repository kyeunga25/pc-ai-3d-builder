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
  workspaceDestinationCopy,
} from "../../shared/domain/workspace-routes";
import { apiFetch } from "../../shared/lib/api-fetch";
import { isPublicDemoPath } from "../../shared/lib/demo-mode";
import {
  accessLogoutPath,
  parseLoginReason,
  type LoginReason,
} from "./access-navigation";
import {
  bilingualLoginTitle,
  loginInterfaceCopy,
  loginReasonCopy,
  type BilingualLoginCopy,
} from "./login-copy";
import "./auth.css";

function LoginBilingualText({ copy }: { copy: BilingualLoginCopy }) {
  return (
    <span className="auth-bilingual-copy">
      <span>{copy.zhHant}</span>
      <span lang="en">{copy.english}</span>
    </span>
  );
}

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
  const destination = workspaceDestinationCopy(returnPath);

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
        <Link
          to="/"
          aria-label={bilingualLoginTitle(
            loginInterfaceCopy.returnToPublicHome,
          )}
        >
          <BrandMark />
        </Link>
        <LoginBilingualText copy={loginInterfaceCopy.inviteOnly} />
      </header>

      <main className="auth-page__main">
        <section className="auth-page__intro" aria-labelledby="login-title">
          <h1 id="login-title">
            <LoginBilingualText copy={loginInterfaceCopy.introTitle} />
          </h1>
          <p>
            <LoginBilingualText copy={loginInterfaceCopy.introDescription} />
          </p>

          <ul
            aria-label={bilingualLoginTitle(
              loginInterfaceCopy.securityBoundaryLabel,
            )}
          >
            <li>
              <ShieldCheck aria-hidden="true" />
              <LoginBilingualText
                copy={loginInterfaceCopy.verifyIdentityBoundary}
              />
            </li>
            <li>
              <KeyRound aria-hidden="true" />
              <LoginBilingualText
                copy={loginInterfaceCopy.membershipBoundary}
              />
            </li>
            <li>
              <LockKeyhole aria-hidden="true" />
              <LoginBilingualText
                copy={loginInterfaceCopy.failClosedBoundary}
              />
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
              <LoginBilingualText copy={loginInterfaceCopy.checkingSession} />
            </p>
          ) : null}

          <div className="auth-card__destination">
            <LoginBilingualText copy={loginInterfaceCopy.destinationLabel} />
            <strong>
              <LoginBilingualText copy={destination} />
            </strong>
          </div>

          <a
            className="button button--primary auth-card__primary"
            href={returnPath}
            aria-label={bilingualLoginTitle(
              loginInterfaceCopy.continueWithAccess,
            )}
          >
            <LoginBilingualText copy={loginInterfaceCopy.continueWithAccess} />
            <ArrowRight aria-hidden="true" />
          </a>

          {reason === "not-authorized" ? (
            <a
              className="auth-card__logout"
              href={accessLogoutPath}
              aria-label={bilingualLoginTitle(
                loginInterfaceCopy.logoutCurrentIdentity,
              )}
            >
              <LoginBilingualText
                copy={loginInterfaceCopy.logoutCurrentIdentity}
              />
            </a>
          ) : null}

          <p className="auth-card__note">
            <LoginBilingualText copy={loginInterfaceCopy.betaNote} />
          </p>

          <Link
            className="auth-card__back"
            to="/"
            aria-label={bilingualLoginTitle(
              loginInterfaceCopy.returnToPublicHome,
            )}
          >
            <ArrowLeft aria-hidden="true" />
            <LoginBilingualText copy={loginInterfaceCopy.returnToPublicHome} />
          </Link>
        </section>
      </main>

      <footer className="auth-page__footer">
        <LoginBilingualText copy={loginInterfaceCopy.footerAccess} />
        <LoginBilingualText copy={loginInterfaceCopy.footerLocked} />
      </footer>
    </div>
  );
}
