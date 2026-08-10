import { describe, expect, it } from "vitest";

import { catalogParts, currentBuild } from "../../shared/domain/mockData";
import type { CatalogPart } from "../../shared/domain/schemas";
import type { RequestContext } from "../auth/workspace";
import { createD1Stub } from "../test/d1-stub";
import { dashboardResponse } from "./dashboard";

const context: RequestContext = {
  user: {
    id: "user-fixture",
    email: "fixture@example.com",
    displayName: "Fixture User",
  },
  currentWorkspace: {
    id: "workspace-fixture",
    slug: "fixture",
    name: "Fixture",
    locale: "zh-Hant-HK",
    currency: "HKD",
    role: "viewer",
  },
  workspaces: [],
};

function catalogueRow(part: CatalogPart) {
  return {
    build_id: "build-fixture",
    id: part.id,
    sku: part.sku,
    category: part.category,
    manufacturer: part.manufacturer,
    model: part.model,
    price_minor: part.priceMinor,
    stock_status: part.stockStatus,
    stock_count: part.stockCount,
    specifications_json: JSON.stringify(part.specifications),
    specification_status: part.specificationStatus,
    status: part.catalogueStatus,
    record_version: part.version,
    asset_id: part.assetId,
    asset_quality: part.assetQuality,
    asset_review_status:
      part.assetStatus === "needs_review"
        ? "in_review"
        : part.assetStatus === "proxy"
          ? null
          : part.assetStatus,
  };
}

describe("dashboard route", () => {
  it("returns workspace-scoped live metrics without writes or identity data", async () => {
    const selectedRows = catalogParts
      .filter((part) => currentBuild.selectedPartIds.includes(part.id))
      .map(catalogueRow);
    const { calls, db } = createD1Stub({
      firstResults: [
        {
          active_catalogue_count: 9,
          verified_catalogue_count: 9,
          approved_asset_count: 5,
          catalogue_ready_count: 5,
          pending_asset_count: 1,
          draft_build_count: 1,
        },
      ],
      allResults: [
        [
          {
            id: "build-fixture",
            name: "測試組裝",
            record_version: 3,
            updated_at: "2026-07-26 04:00:00",
          },
        ],
        [
          {
            id: "asset-fixture",
            status: "in_review",
            manufacturer: "Fixture",
            model: "Reviewed Part",
            updated_at: "2026-07-26 05:00:00",
          },
        ],
        selectedRows,
      ],
    });

    const response = await dashboardResponse(db, context);
    const text = await response.text();
    const body = JSON.parse(text) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body).toMatchObject({
      metrics: {
        activeCatalogueCount: 9,
        verifiedCatalogueCount: 9,
        approvedAssetCount: 5,
        catalogueReadyCount: 5,
        pendingAssetCount: 1,
        draftBuildCount: 1,
        evaluatedBuildCount: 1,
        readyBuildCount: 1,
        attentionBuildCount: 0,
      },
      recentWork: [
        {
          kind: "asset_review",
          title: "Fixture Reviewed Part",
          statusZhHant: "審核中",
          href: "/asset-review",
          targetAssetId: "asset-fixture",
        },
        {
          kind: "build_ready",
          title: "測試組裝",
          statusZhHant: "可匯出",
        },
      ],
    });
    expect(text).not.toContain("workspace-fixture");
    expect(text).not.toContain("fixture@example.com");
    expect(text).not.toContain("?asset=");
    expect(calls.every((call) => call.values[0] === "workspace-fixture")).toBe(
      true,
    );
    expect(
      calls.every(
        (call) => !/\b(?:INSERT|UPDATE|DELETE|REPLACE)\b/iu.test(call.sql),
      ),
    ).toBe(true);
  });

  it("represents an empty workspace without creating records", async () => {
    const { calls, db } = createD1Stub({
      firstResults: [
        {
          active_catalogue_count: 0,
          verified_catalogue_count: 0,
          approved_asset_count: 0,
          catalogue_ready_count: 0,
          pending_asset_count: 0,
          draft_build_count: 0,
        },
      ],
      allResults: [[], []],
    });

    const response = await dashboardResponse(db, context);

    await expect(response.json()).resolves.toMatchObject({
      metrics: {
        activeCatalogueCount: 0,
        evaluatedBuildCount: 0,
      },
      recentWork: [],
    });
    expect(calls).toHaveLength(3);
  });
});
