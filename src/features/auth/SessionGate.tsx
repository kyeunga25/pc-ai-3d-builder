import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";

import { BrandMark } from "../../shared/components/BrandMark";
import { LoadingState } from "../../shared/components/AsyncState";
import { createLoginPagePath } from "./access-navigation";
import { useSessionState } from "./session-context";
import "./auth.css";

export function SessionGate({ children }: { children: ReactNode }) {
  const state = useSessionState();
  const location = useLocation();

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

  const reason =
    state.status === "denied"
      ? state.error.status === 401
        ? "session-expired"
        : "not-authorized"
      : "service-unavailable";

  return (
    <Navigate
      replace
      to={createLoginPagePath(
        reason,
        `${location.pathname}${location.search}${location.hash}`,
      )}
    />
  );
}
