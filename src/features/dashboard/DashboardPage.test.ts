import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import { AssetReviewNavigationProvider } from "../asset-review/AssetReviewNavigationProvider";
import { SessionContext } from "../auth/session-context";
import { DashboardPage } from "./DashboardPage";

const currentWorkspace = {
  id: "workspace-dashboard-fixture",
  slug: "dashboard-fixture",
  name: "Dashboard Fixture",
  locale: "zh-Hant-HK",
  currency: "HKD",
  role: "owner" as const,
};

const sessionValue = {
  status: "authenticated" as const,
  session: {
    user: {
      id: "user-dashboard-fixture",
      email: "dashboard-fixture@example.invalid",
      displayName: "Dashboard Fixture",
    },
    currentWorkspace,
    workspaces: [currentWorkspace],
  },
  error: null,
  workspaceSelection: {
    status: "idle" as const,
    targetWorkspaceId: null,
    error: null,
  },
  dismissWorkspaceSelectionError() {},
  reload() {},
  selectWorkspace() {},
};

describe("DashboardPage", () => {
  it("links to asset review without serializing an asset identifier", () => {
    const markup = renderToStaticMarkup(
      createElement(
        SessionContext.Provider,
        { value: sessionValue },
        createElement(
          MemoryRouter,
          { initialEntries: ["/dashboard"] },
          createElement(
            AssetReviewNavigationProvider,
            null,
            createElement(DashboardPage),
          ),
        ),
      ),
    );

    expect(markup).toContain('href="/asset-review"');
    expect(markup).toContain("3D asset is under review · Synthetic demo data");
    expect(markup).toContain("Under review");
    expect(markup).toContain("9 components · Synthetic demo build");
    expect(markup).toContain("Export ready");
    expect(markup).toContain("Earlier update");
    expect(markup).not.toContain("?asset=");
  });
});
