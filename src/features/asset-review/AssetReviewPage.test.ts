import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import { reviewAsset } from "../../shared/domain/mockData";
import { SessionContext } from "../auth/session-context";
import { AssetReviewPage } from "./AssetReviewPage";
import { AssetReviewNavigationProvider } from "./AssetReviewNavigationProvider";

const currentWorkspace = {
  id: "workspace-review-fixture",
  slug: "review-fixture",
  name: "Review Fixture",
  locale: "zh-Hant-HK",
  currency: "HKD",
  role: "owner" as const,
};

const sessionValue = {
  status: "authenticated" as const,
  session: {
    user: {
      id: "user-review-fixture",
      email: "review-fixture@example.invalid",
      displayName: "Review Fixture",
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

function renderPage(
  localAsset = reviewAsset,
  initialEntry = "/asset-review",
): string {
  return renderToStaticMarkup(
    createElement(
      SessionContext.Provider,
      { value: sessionValue },
      createElement(
        MemoryRouter,
        {
          initialEntries: [
            {
              pathname: initialEntry,
              state: { localAsset },
            },
          ],
        },
        createElement(
          AssetReviewNavigationProvider,
          null,
          createElement(AssetReviewPage),
        ),
      ),
    ),
  );
}

describe("AssetReviewPage", () => {
  it("renders every critical review action in Traditional Chinese and English", () => {
    const markup = renderPage();

    expect(markup).toContain("拒絕");
    expect(markup).toContain("Reject");
    expect(markup).toContain("建立模擬 GLB 草稿");
    expect(markup).toContain("Create simulated GLB draft");
    expect(markup).toContain("儲存草稿");
    expect(markup).toContain("Save draft");
    expect(markup).toContain("核准素材");
    expect(markup).toContain("Approve asset");
    expect(markup).toContain('lang="en"');
    expect(markup).toContain('aria-pressed="false"');
    expect(markup).toContain(
      "拒絕會更新審核狀態 / Rejection updates the review status",
    );
    expect(markup).not.toContain(reviewAsset.id);
  });

  it("renders the approved demo recovery action and live status bilingually", () => {
    const markup = renderPage({
      ...reviewAsset,
      status: "approved",
      quality: "approved",
    });

    expect(markup).toContain("在 Builder 檢查");
    expect(markup).toContain("Check in Builder");
    expect(markup).toContain("合成資料變更只保留在本機");
    expect(markup).toContain("Synthetic changes stay in this local session");
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain('class="asset-review-status is-info"');
    expect(markup).toContain('role="status"');
    expect(markup).toContain("lucide-info");
  });
});
