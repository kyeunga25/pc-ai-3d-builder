import { describe, expect, it } from "vitest";

import type { SessionResponse } from "../../shared/domain/session";
import type { SessionError } from "./session-context";
import {
  createSessionControllerState,
  sessionControllerReducer,
} from "./session-state";

const alphaWorkspace = {
  id: "workspace-alpha",
  slug: "alpha",
  name: "Alpha Fixture",
  locale: "zh-Hant-HK",
  currency: "HKD",
  role: "owner" as const,
};

const betaWorkspace = {
  id: "workspace-beta",
  slug: "beta",
  name: "Beta Fixture",
  locale: "zh-Hant-HK",
  currency: "HKD",
  role: "admin" as const,
};

const alphaSession: SessionResponse = {
  user: {
    id: "user-session-fixture",
    email: "session-fixture@example.invalid",
    displayName: "Session Fixture",
  },
  currentWorkspace: alphaWorkspace,
  workspaces: [alphaWorkspace, betaWorkspace],
};

const betaSession: SessionResponse = {
  ...alphaSession,
  currentWorkspace: betaWorkspace,
};

const targetDenied: SessionError = {
  status: 403,
  code: "WORKSPACE_FORBIDDEN",
};

describe("session workspace selection state", () => {
  it("keeps the authenticated workspace while a target switch is pending", () => {
    const initial = createSessionControllerState({
      status: "authenticated",
      session: alphaSession,
      error: null,
    });

    const switching = sessionControllerReducer(initial, {
      type: "workspace-selection-started",
      targetWorkspaceId: betaWorkspace.id,
    });

    expect(switching.sessionState).toEqual(initial.sessionState);
    expect(switching.workspaceSelection).toEqual({
      status: "switching",
      targetWorkspaceId: betaWorkspace.id,
      error: null,
    });
  });

  it.each([
    [targetDenied],
    [{ status: 0, code: "SESSION_UNAVAILABLE" }],
  ] satisfies Array<[SessionError]>)(
    "retains the current session after a target-only or transient failure: %o",
    (error) => {
      const switching = sessionControllerReducer(
        createSessionControllerState({
          status: "authenticated",
          session: alphaSession,
          error: null,
        }),
        {
          type: "workspace-selection-started",
          targetWorkspaceId: betaWorkspace.id,
        },
      );

      const failed = sessionControllerReducer(switching, {
        type: "workspace-selection-failed",
        targetWorkspaceId: betaWorkspace.id,
        error,
      });

      expect(failed.sessionState).toMatchObject({
        status: "authenticated",
        session: { currentWorkspace: { id: alphaWorkspace.id } },
      });
      expect(failed.workspaceSelection).toEqual({
        status: "error",
        targetWorkspaceId: betaWorkspace.id,
        error,
      });
    },
  );

  it("applies only a successful server session and clears the pending target", () => {
    const switching = sessionControllerReducer(
      createSessionControllerState({
        status: "authenticated",
        session: alphaSession,
        error: null,
      }),
      {
        type: "workspace-selection-started",
        targetWorkspaceId: betaWorkspace.id,
      },
    );

    const succeeded = sessionControllerReducer(switching, {
      type: "workspace-selection-succeeded",
      session: betaSession,
    });

    expect(succeeded.sessionState).toMatchObject({
      status: "authenticated",
      session: { currentWorkspace: { id: betaWorkspace.id } },
    });
    expect(succeeded.workspaceSelection).toEqual({
      status: "idle",
      targetWorkspaceId: null,
      error: null,
    });
  });

  it.each([
    [{ status: 401, code: "ACCESS_TOKEN_INVALID" }],
    [{ status: 403, code: "INVITE_REQUIRED" }],
    [{ status: 403, code: "IDENTITY_BINDING_CONFLICT" }],
  ] satisfies Array<[SessionError]>)(
    "invalidates the stale current session for a global denial: %o",
    (error) => {
      const switching = sessionControllerReducer(
        createSessionControllerState({
          status: "authenticated",
          session: alphaSession,
          error: null,
        }),
        {
          type: "workspace-selection-started",
          targetWorkspaceId: betaWorkspace.id,
        },
      );

      const failed = sessionControllerReducer(switching, {
        type: "workspace-selection-failed",
        targetWorkspaceId: betaWorkspace.id,
        error,
      });

      expect(failed.sessionState).toEqual({
        status: "denied",
        session: null,
        error,
      });
      expect(failed.workspaceSelection.status).toBe("idle");
    },
  );

  it("dismisses a recoverable error without changing the current session", () => {
    const failed = sessionControllerReducer(
      createSessionControllerState({
        status: "authenticated",
        session: alphaSession,
        error: null,
      }),
      {
        type: "workspace-selection-failed",
        targetWorkspaceId: betaWorkspace.id,
        error: targetDenied,
      },
    );

    const dismissed = sessionControllerReducer(failed, {
      type: "workspace-selection-dismissed",
    });

    expect(dismissed.sessionState).toEqual(failed.sessionState);
    expect(dismissed.workspaceSelection.status).toBe("idle");
  });
});
