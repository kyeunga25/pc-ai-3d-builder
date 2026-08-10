import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import {
  SessionContext,
  type SessionContextValue,
  type WorkspaceSelectionState,
} from "../../features/auth/session-context";
import { MerchantShell } from "./MerchantShell";

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

function renderShell(workspaceSelection: WorkspaceSelectionState): string {
  const value: SessionContextValue = {
    status: "authenticated",
    session: {
      user: {
        id: "user-shell-fixture",
        email: "shell-fixture@example.invalid",
        displayName: "Shell Fixture",
      },
      currentWorkspace: alphaWorkspace,
      workspaces: [alphaWorkspace, betaWorkspace],
    },
    error: null,
    workspaceSelection,
    dismissWorkspaceSelectionError() {},
    reload() {},
    selectWorkspace() {},
  };

  return renderToStaticMarkup(
    createElement(
      SessionContext.Provider,
      { value },
      createElement(
        MemoryRouter,
        { initialEntries: ["/dashboard"] },
        createElement(MerchantShell),
      ),
    ),
  );
}

describe("MerchantShell workspace selection", () => {
  it("keeps the current workspace visible and exposes bilingual recovery actions", () => {
    const markup = renderShell({
      status: "error",
      targetWorkspaceId: betaWorkspace.id,
      error: { status: 403, code: "WORKSPACE_FORBIDDEN" },
    });

    expect(markup).toContain('role="alert"');
    expect(markup).toContain("未能切換至 Beta Fixture");
    expect(markup).toContain("Unable to switch to Beta Fixture");
    expect(markup).toContain("目前仍顯示 Alpha Fixture");
    expect(markup).toContain("The current workspace remains Alpha Fixture");
    expect(markup).toContain("重試");
    expect(markup).toContain("Retry");
    expect(markup).toContain("留在目前工作空間");
    expect(markup).toContain("Stay here");
    expect(markup).not.toContain("WORKSPACE_FORBIDDEN");
  });

  it("disables repeated selection and announces the target while switching", () => {
    const markup = renderShell({
      status: "switching",
      targetWorkspaceId: betaWorkspace.id,
      error: null,
    });

    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain("正在切換至 Beta Fixture");
    expect(markup).toContain("Switching to Beta Fixture");
    expect(markup).toMatch(/<select[^>]*disabled=""/u);
    expect(markup).not.toContain('role="alert"');
  });
});
