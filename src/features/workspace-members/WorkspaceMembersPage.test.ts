import { readFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import {
  SessionContext,
  type SessionContextValue,
} from "../auth/session-context";
import type { WorkspaceRole } from "../../shared/domain/session";
import { WorkspaceMembersPage } from "./WorkspaceMembersPage";

function renderPage(role: WorkspaceRole): string {
  const workspace = {
    id: "workspace-members-page-fixture",
    slug: "members-page-fixture",
    name: "Members Page Fixture",
    locale: "zh-Hant-HK",
    currency: "HKD",
    role,
  };
  const value: SessionContextValue = {
    status: "authenticated",
    session: {
      user: {
        id: "user_private_current_fixture",
        email: "current@example.invalid",
        displayName: "Current Fixture",
      },
      currentWorkspace: workspace,
      workspaces: [workspace],
    },
    error: null,
    workspaceSelection: {
      status: "idle",
      targetWorkspaceId: null,
      error: null,
    },
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
        { initialEntries: ["/dashboard/members"] },
        createElement(WorkspaceMembersPage),
      ),
    ),
  );
}

describe("WorkspaceMembersPage", () => {
  it("renders a bilingual synthetic management flow without member IDs", () => {
    const markup = renderPage("owner");

    expect(markup).toContain("工作空間成員管理");
    expect(markup).toContain("Workspace member management");
    expect(markup).toContain("建立 D1 邀請");
    expect(markup).toContain("Create D1 invitation");
    expect(markup).toContain("不會修改 Cloudflare Access policy");
    expect(markup).toContain("does not change the Cloudflare Access policy");
    expect(markup).toContain("等待首次驗證");
    expect(markup).toContain("Awaiting first verification");
    expect(markup).toContain("停用成員");
    expect(markup).toContain("Suspend member");
    expect(markup).toContain("operator@example.invalid");
    expect(markup).not.toContain("user_private_current_fixture");
    expect(markup).not.toContain("user_synthetic_operator");
  });

  it("does not expose the directory or invitation form to staff", () => {
    const markup = renderPage("staff");

    expect(markup).toContain("沒有成員管理權限");
    expect(markup).toContain("Member management unavailable");
    expect(markup).not.toContain("operator@example.invalid");
    expect(markup).not.toContain("Create D1 invitation");
  });

  it("keeps controls readable and contained at phone width", async () => {
    const styles = await readFile(
      new URL("./workspace-members.css", import.meta.url),
      "utf8",
    );

    expect(styles).toContain("@media (max-width: 680px)");
    expect(styles).toContain("grid-template-columns: 1fr");
    expect(styles).toContain("flex-wrap: wrap");
    expect(styles).toContain("flex: 1 1 180px");
    expect(styles).toContain("min-width: min(180px, 100%)");
    expect(styles).toContain("overflow-wrap: anywhere");
    expect(styles).toContain("width: 100%");
  });
});
