import { readFile } from "node:fs/promises";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import { reviewAsset } from "../../shared/domain/mockData";
import type { GenerationJobListResponse } from "../../shared/domain/generation-jobs";
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
  sourceUrl?: string,
  generationState?: GenerationJobListResponse,
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
              state: { generationState, localAsset, sourceUrl },
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

  it("shows queued-only two-step cancellation without exposing its job ID", () => {
    const jobId = "generation-private-cancel-fixture";
    const markup = renderPage(reviewAsset, "/asset-review", undefined, {
      capability: {
        mode: "simulation",
        maxCostMinor: 0,
        credits: {
          availableUnits: 1,
          reservedUnits: 1,
          settledUnits: 0,
          releasedUnits: 0,
        },
      },
      items: [
        {
          id: jobId,
          assetId: reviewAsset.id,
          status: "queued",
          kind: "simulation",
          outputReady: false,
          failureCode: null,
          entitlementStatus: "reserved",
          providerCostUnits: null,
          validationCode: null,
          createdAt: "2026-08-30T00:00:00Z",
          updatedAt: "2026-08-30T00:00:00Z",
        },
      ],
    });

    expect(markup).toContain("取消排隊工作");
    expect(markup).toContain("Cancel queued job");
    expect(markup).toContain(
      "Only a job not yet started by Workflow can be cancelled",
    );
    expect(markup).toContain('aria-pressed="false"');
    expect(markup).not.toContain(jobId);
  });

  it("renders current-asset generation history without IDs or foreign state", () => {
    const currentCancelledId = "generation-current-cancelled-private";
    const currentFailedId = "generation-current-failed-private";
    const foreignQueuedId = "generation-foreign-queued-private";
    const markup = renderPage(reviewAsset, "/asset-review", undefined, {
      capability: {
        mode: "simulation",
        maxCostMinor: 0,
        credits: {
          availableUnits: 2,
          reservedUnits: 0,
          settledUnits: 0,
          releasedUnits: 1,
        },
      },
      items: [
        {
          id: foreignQueuedId,
          assetId: "asset-foreign-private",
          status: "queued",
          kind: "simulation",
          outputReady: false,
          failureCode: null,
          entitlementStatus: "reserved",
          providerCostUnits: null,
          validationCode: null,
          createdAt: "2026-08-30T02:00:00Z",
          updatedAt: "2026-08-30T02:00:00Z",
        },
        {
          id: currentCancelledId,
          assetId: reviewAsset.id,
          status: "cancelled",
          kind: "simulation",
          outputReady: false,
          failureCode: null,
          entitlementStatus: "released",
          providerCostUnits: null,
          validationCode: null,
          createdAt: "2026-08-30T01:00:00Z",
          updatedAt: "2026-08-30T01:01:00Z",
        },
        {
          id: currentFailedId,
          assetId: reviewAsset.id,
          status: "failed",
          kind: "simulation",
          outputReady: false,
          failureCode: "GENERATION_INPUT_STALE",
          entitlementStatus: "released",
          providerCostUnits: null,
          validationCode: null,
          createdAt: "2026-08-30T00:00:00Z",
          updatedAt: "2026-08-30T00:01:00Z",
        },
      ],
    });

    expect(markup).toContain("最近生成工作");
    expect(markup).toContain("Recent generation jobs");
    expect(markup).toContain("顯示 2 項");
    expect(markup).toContain("Showing 2 jobs");
    expect(markup).toContain("工作已取消");
    expect(markup).toContain("Job cancelled");
    expect(markup).toContain("工作失敗");
    expect(markup).toContain("Job failed");
    expect(markup).not.toContain("已排入佇列");
    expect(markup).not.toContain("Queued");
    expect(markup).not.toContain(currentCancelledId);
    expect(markup).not.toContain(currentFailedId);
    expect(markup).not.toContain(foreignQueuedId);
    expect(markup).not.toContain("GENERATION_INPUT_STALE");
  });

  it("keeps generation history inside a bounded responsive scroll area", async () => {
    const styles = await readFile(
      new URL("./asset-review.css", import.meta.url),
      "utf8",
    );

    expect(styles).toMatch(
      /\.generation-job-history ol\s*\{[^}]*max-height:\s*280px;[^}]*overflow-y:\s*auto;/u,
    );
    expect(styles).toMatch(
      /\.generation-job-history li\s*\{[^}]*min-width:\s*0;/u,
    );
    expect(styles).toMatch(
      /\.generation-job-history__time time\s*\{[^}]*min-width:\s*0;/u,
    );
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
    expect(markup).toContain("affects only the selected view or GLB");
    expect(markup).toContain("all other private files remain private");
  });

  it("renders exact two-step removal controls only for stored private files", () => {
    const markup = renderPage({
      ...reviewAsset,
      files: {
        sources: {
          ...reviewAsset.files.sources,
          front: { contentType: "image/png", sizeBytes: 2_048 },
        },
        model: { contentType: "model/gltf-binary", sizeBytes: 4_096 },
      },
    });

    expect(markup).toContain("移除圖片");
    expect(markup).toContain("Remove image");
    expect(markup).toContain("移除 GLB");
    expect(markup).toContain("Remove GLB");
    expect(markup).toContain(
      "After confirmation, only the selected source view is removed",
    );
    expect(markup).toContain(
      "After confirmation, only the private GLB is removed",
    );
    expect(markup.match(/lucide-trash-2/gu)).toHaveLength(2);
  });

  it("keeps private file actions readable in the narrow layout", async () => {
    const styles = await readFile(
      new URL("./asset-review.css", import.meta.url),
      "utf8",
    );

    expect(styles).not.toContain(".asset-file-control span,");
    expect(styles).toContain(".asset-file-control > div > span,");
    expect(styles).toContain(".asset-file-control .button--danger.is-armed");
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

  it("renders source views, private loading state and usage rights bilingually", () => {
    const missingMarkup = renderPage({
      ...reviewAsset,
      completedChecks: reviewAsset.completedChecks.filter(
        (check) => check !== "source_rights",
      ),
      sourceRightsConfirmed: false,
    });
    const loadedMarkup = renderPage(
      reviewAsset,
      "/asset-review",
      "blob:synthetic-private-source",
    );

    expect(missingMarkup).toContain("Source images");
    expect(missingMarkup).toContain("No private source image loaded");
    expect(missingMarkup).toContain("Front");
    expect(missingMarkup).toContain("Back");
    expect(missingMarkup).toContain("Left");
    expect(missingMarkup).toContain("Three-quarter");
    const sourceFrames = missingMarkup.match(
      /<button class="source-frame[^"]*"[^>]*>/gu,
    );
    expect(sourceFrames).toHaveLength(4);
    expect(
      sourceFrames?.filter((frame) => frame.includes('aria-pressed="true"')),
    ).toHaveLength(1);
    expect(sourceFrames?.every((frame) => !frame.includes("disabled"))).toBe(
      true,
    );
    expect(missingMarkup).toContain("Image usage rights not confirmed");
    expect(missingMarkup).toContain("source-rights is-missing");
    expect(loadedMarkup).toContain("Loaded through the authorized API");
    expect(loadedMarkup).toContain(
      "Front private source preview for RigStage Fixture 162 mm Tower Cooler",
    );
    expect(loadedMarkup).toContain(
      "Commercial usage-rights confirmation recorded",
    );
    expect(loadedMarkup).toContain("source-rights is-confirmed");
  });

  it("bounds bilingual source-view labels inside phone thumbnails", async () => {
    const styles = await readFile(
      new URL("./asset-review.css", import.meta.url),
      "utf8",
    );

    expect(styles).toMatch(
      /\.source-frame small\s*\{[^}]*max-width:\s*calc\(100% - 14px\);/u,
    );
    expect(styles).toContain(".source-frame .review-bilingual-copy");
    expect(styles).not.toContain(".review-panel-heading span {");
    expect(styles).toContain(".review-panel-heading > div > span {");
  });

  it("renders the asset header and review metadata bilingually", () => {
    const markup = renderPage();

    expect(markup).toContain("Private asset");
    expect(markup).toContain("Version 0");
    expect(markup).toContain(
      "All generated or uploaded material remains a draft",
    );
    expect(markup).toContain("Needs review");
    expect(markup).toContain("1 item in queue");
    expect(markup).toContain("Asset details");
    expect(markup).toContain("Synthetic test asset");
    expect(markup).toContain("Product SKU");
    expect(markup).toContain("Quality");
    expect(markup).toContain("Draft quality");
    expect(markup).toContain("Review version");
  });

  it.each([
    ["draft", "Draft"],
    ["in_review", "Needs review"],
    ["approved", "Approved"],
    ["rejected", "Rejected"],
  ] as const)("renders %s status bilingually", (status, english) => {
    const markup = renderPage({ ...reviewAsset, status });

    expect(markup).toContain(english);
  });

  it("allows the bilingual header badge to wrap at narrow widths", async () => {
    const styles = await readFile(
      new URL("./asset-review.css", import.meta.url),
      "utf8",
    );

    expect(styles).toMatch(
      /\.asset-review-header__meta \.status-badge\s*\{[^}]*white-space:\s*normal;/u,
    );
  });
});
