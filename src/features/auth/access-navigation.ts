import { safeWorkspaceLoginReturnPath } from "../../shared/domain/workspace-routes";

export const workspaceLoginPath = "/dashboard";
export const accessLogoutPath = "/cdn-cgi/access/logout";
export const loginPagePath = "/login";

export const loginReasons = [
  "sign-in",
  "access-required",
  "session-expired",
  "not-authorized",
  "service-unavailable",
] as const;

export type LoginReason = (typeof loginReasons)[number];

export function parseLoginReason(value: string | null): LoginReason {
  return loginReasons.includes(value as LoginReason)
    ? (value as LoginReason)
    : "sign-in";
}

export function createLoginPagePath(reason: LoginReason, next: string): string {
  const params = new URLSearchParams({
    reason,
    next: safeWorkspaceLoginReturnPath(next),
  });
  return `${loginPagePath}?${params.toString()}`;
}
