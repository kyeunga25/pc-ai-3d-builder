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
import { WorkspaceActivityPage } from "./WorkspaceActivityPage";

function renderPage(role: WorkspaceRole): string {
  const workspace = {
    id: "workspace-activity-page-fixture",
    slug: "activity-page-fixture",
    name: "Activity Page Fixture",
    locale: "zh-Hant-HK",
    currency: "HKD",
    role,
  };
  const value: SessionContextValue = {
    status: "authenticated",
    session: {
      user: {
        id: "user_private_activity_fixture",
        email: "activity-current@example.invalid",
        displayName: "Synthetic Activity Owner",
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
        { initialEntries: ["/dashboard/activity"] },
        createElement(WorkspaceActivityPage),
      ),
    ),
  );
}

describe("WorkspaceActivityPage", () => {
  it("renders a bilingual synthetic activity flow without private identifiers", () => {
    const markup = renderPage("owner");

    expect(markup).toContain("工作空間活動記錄");
    expect(markup).toContain("Workspace activity log");
    expect(markup).toContain("建立成員邀請");
    expect(markup).toContain("Member invitation created");
    expect(markup).toContain("生成草稿等待審核");
    expect(markup).toContain("Generated draft awaiting review");
    expect(markup).toContain("不顯示電郵、私人目標 ID");
    expect(markup).toContain("does not display emails, private target IDs");
    expect(markup).toContain("系統流程");
    expect(markup).toContain("System workflow");
    expect(markup).not.toContain("user_private_activity_fixture");
    expect(markup).not.toContain("activity-current@example.invalid");
    expect(markup).not.toContain("request-private");
    expect(markup).not.toContain("target-private");
  });

  it("does not expose activity records to staff", () => {
    const markup = renderPage("staff");

    expect(markup).toContain("沒有活動記錄權限");
    expect(markup).toContain("Activity log unavailable");
    expect(markup).not.toContain("Member invitation created");
  });

  it("keeps filters, cards and actions contained at phone width", async () => {
    const styles = await readFile(
      new URL("./workspace-activity.css", import.meta.url),
      "utf8",
    );

    expect(styles).toContain("@media (max-width: 680px)");
    expect(styles).toContain("grid-template-columns: 1fr");
    expect(styles).toContain("flex-wrap: wrap");
    expect(styles).toContain("min-width: min(220px, 100%)");
    expect(styles).toContain("overflow-wrap: anywhere");
    expect(styles).toContain("width: 100%");
  });
});
