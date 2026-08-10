import { readFile } from "node:fs/promises";

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

  it("explains generation work and non-monetary credit bilingually", () => {
    const markup = renderPage();

    expect(markup).toContain("生成工作");
    expect(markup).toContain("Generation job");
    expect(markup).toContain("非貨幣 Credit");
    expect(markup).toContain("Non-monetary credit");
    expect(markup).toContain("零成本模擬");
    expect(markup).toContain("Zero-cost simulation");
    expect(markup).toContain("尚未有工作");
    expect(markup).toContain("No job yet");
  });

  it("explains private file controls and evidence reset bilingually", () => {
    const markup = renderPage();

    expect(markup).toContain("私人素材檔案");
    expect(markup).toContain("Private asset files");
    expect(markup).toContain("Access and workspace checks are required");
    expect(markup).toContain("Create synthetic image");
    expect(markup).toContain("Upload image");
    expect(markup).toContain("3D model");
    expect(markup).toContain("Upload GLB");
    expect(markup).toContain("resets the approval checklist");
    expect(markup).toContain("Only the selected file is replaced");
    expect(markup).toContain("other private file remains private");
  });

  it("keeps private file actions readable in the narrow layout", async () => {
    const styles = await readFile(
      new URL("./asset-review.css", import.meta.url),
      "utf8",
    );

    expect(styles).not.toContain(".asset-file-control span,");
    expect(styles).toContain(".asset-file-control > div > span,");
    expect(styles).toMatch(
      /@media[^]*?\.asset-file-control\s*\{[^}]*flex-direction:\s*column;/u,
    );
  });

  it("renders verified dimensions and every approval check bilingually", () => {
    const markup = renderPage();

    expect(markup).toContain("核實尺寸");
    expect(markup).toContain("Verified dimensions");
    expect(markup).toContain("Only enter values checked by a person");
    expect(markup).toContain("Width");
    expect(markup).toContain("Height");
    expect(markup).toContain("Depth");
    expect(markup).toContain("核准清單");
    expect(markup).toContain("Approval checklist");
    expect(markup).toContain("5 of 6 checks complete");
    expect(markup).toContain("Model and SKU are correct");
    expect(markup).toContain("Image usage rights are confirmed");
  });

  it("stacks verified dimension fields at phone width", async () => {
    const styles = await readFile(
      new URL("./asset-review.css", import.meta.url),
      "utf8",
    );

    expect(styles).toMatch(
      /@media \(max-width: 480px\)[^]*?\.dimension-grid\s*\{[^}]*grid-template-columns:\s*1fr;/u,
    );
  });

  it("explains viewport controls, model state and evidence limits bilingually", () => {
    const markup = renderPage();

    expect(markup).toContain("3D asset review viewport");
    expect(markup).toContain("Camera preset angles");
    expect(markup).toContain("Front");
    expect(markup).toContain("Left");
    expect(markup).toContain("Top");
    expect(markup).toContain("Isometric");
    expect(markup).toContain("Fit model to view");
    expect(markup).toContain("Toggle wireframe view");
    expect(markup).toContain("Camera: Isometric");
    expect(markup).toContain("No private GLB uploaded");
    expect(markup).toContain("Visual material is not compatibility evidence");
  });

  it("lets bilingual viewport status wrap without a fixed footer row", async () => {
    const styles = await readFile(
      new URL("./asset-review.css", import.meta.url),
      "utf8",
    );

    expect(styles).toContain("grid-template-rows: 64px minmax(0, 1fr) auto;");
    expect(styles).toMatch(
      /\.review-viewport__footer\s*\{[^}]*flex-wrap:\s*wrap;/u,
    );
  });
});
