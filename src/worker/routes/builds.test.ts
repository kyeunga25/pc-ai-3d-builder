import { describe, expect, it } from "vitest";

import { catalogParts, currentBuild } from "../../shared/domain/mockData";
import type { CatalogPart } from "../../shared/domain/schemas";
import type { WorkspaceRole } from "../../shared/domain/session";
import type { RequestContext } from "../auth/workspace";
import { createD1Stub } from "../test/d1-stub";
import {
  buildCreateResponse,
  buildDetailResponse,
  buildExportResponse,
  buildListResponse,
  buildMutationResponse,
} from "./builds";

function context(role: WorkspaceRole = "owner"): RequestContext {
  return {
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
      role,
    },
    workspaces: [],
  };
}

const buildRow = {
  id: "build-fixture",
  name: "測試組裝",
  status: "draft",
  record_version: 0,
  updated_at: "2026-07-26T00:00:00Z",
};

function catalogueRow(part: CatalogPart) {
  return {
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

describe("persistent build routes", () => {
  it("returns a bounded workspace-scoped build list", async () => {
    const { calls, db } = createD1Stub({
      allResults: [[{ ...buildRow, selected_count: 4 }]],
    });

    const response = await buildListResponse(db, context("viewer"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      items: [
        {
          id: "build-fixture",
          name: "測試組裝",
          selectedCount: 4,
          version: 0,
          updatedAt: "2026-07-26T00:00:00Z",
        },
      ],
    });
    expect(calls[0]?.values).toEqual(["workspace-fixture"]);
    expect(calls[0]?.sql).toContain("LIMIT 50");
  });

  it("reads build detail only through workspace-bound lookups", async () => {
    const selectedPart = catalogParts[0]!;
    const { calls, db } = createD1Stub({
      firstResults: [buildRow],
      allResults: [[catalogueRow(selectedPart)]],
    });

    const response = await buildDetailResponse(
      db,
      context("viewer"),
      "build-fixture",
    );
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(calls[0]?.values).toEqual(["workspace-fixture", "build-fixture"]);
    expect(calls[1]?.values).toEqual(["workspace-fixture", "build-fixture"]);
    expect(text).not.toContain("workspace-fixture");
  });

  it("treats a build outside the resolved workspace as not found", async () => {
    const { calls, db } = createD1Stub({ firstResults: [null] });

    await expect(
      buildDetailResponse(db, context("viewer"), "build-foreign"),
    ).rejects.toMatchObject({ status: 404, code: "BUILD_NOT_FOUND" });
    expect(calls[0]?.values).toEqual(["workspace-fixture", "build-foreign"]);
  });

  it("rejects viewer creation before reading the request or database", async () => {
    const { calls, db } = createD1Stub();
    const request = new Request("https://app.example/api/builds", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "測試組裝", selectedPartIds: [] }),
    });

    await expect(
      buildCreateResponse(request, db, context("viewer"), "request-fixture"),
    ).rejects.toMatchObject({ code: "ROLE_FORBIDDEN" });
    expect(calls).toHaveLength(0);
  });

  it("creates selected items and a minimal audit event in one batch", async () => {
    const selectedPart = catalogParts[0]!;
    const row = catalogueRow(selectedPart);
    const { calls, db } = createD1Stub({
      firstResults: [buildRow],
      allResults: [[row], [row]],
    });
    const request = new Request("https://app.example/api/builds", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "測試組裝",
        selectedPartIds: [selectedPart.id],
      }),
    });

    const response = await buildCreateResponse(
      request,
      db,
      context("staff"),
      "request-fixture",
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      id: "build-fixture",
      name: "測試組裝",
      selectedParts: [{ id: selectedPart.id }],
    });
    expect(
      calls.some(
        (call) =>
          call.sql.includes("INSERT INTO audit_events") &&
          call.values.includes("request-fixture"),
      ),
    ).toBe(true);
    expect(
      calls.some((call) => call.sql.includes("INSERT INTO build_items")),
    ).toBe(true);
  });

  it("uses an unexposed mutation token and rejects stale versions", async () => {
    const { calls, db } = createD1Stub({
      batchChanges: 0,
      firstResults: [{ ...buildRow, record_version: 2 }],
    });
    const request = new Request(
      "https://app.example/api/builds/build-fixture",
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "update",
          expectedVersion: 0,
          name: "較舊組裝",
          selectedPartIds: [],
        }),
      },
    );

    await expect(
      buildMutationResponse(
        request,
        db,
        context(),
        "build-fixture",
        "request-fixture",
      ),
    ).rejects.toMatchObject({ code: "BUILD_VERSION_CONFLICT" });
    expect(
      calls.some(
        (call) =>
          call.sql.includes("DELETE FROM build_items") &&
          call.sql.includes("mutation_token"),
      ),
    ).toBe(true);
  });

  it("logically archives a build and its audit event in one guarded batch", async () => {
    const { calls, db } = createD1Stub();
    const request = new Request(
      "https://app.example/api/builds/build-fixture",
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "archive",
          expectedVersion: 0,
        }),
      },
    );

    const response = await buildMutationResponse(
      request,
      db,
      context("staff"),
      "build-fixture",
      "request-fixture",
    );

    expect(response.status).toBe(204);
    expect(
      calls.some(
        (call) =>
          call.sql.includes("SET status = 'archived'") &&
          call.sql.includes("record_version = ?5"),
      ),
    ).toBe(true);
    expect(
      calls.some(
        (call) =>
          call.sql.includes("INSERT INTO audit_events") &&
          call.values.includes("build.archive"),
      ),
    ).toBe(true);
  });

  it("exports a ready build without operational or private fields", async () => {
    const selectedRows = catalogParts
      .filter((part) => currentBuild.selectedPartIds.includes(part.id))
      .map(catalogueRow);
    const { db } = createD1Stub({
      firstResults: [buildRow],
      allResults: [selectedRows],
    });

    const response = await buildExportResponse(
      db,
      context("viewer"),
      "build-fixture",
    );
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="rigstage-build.json"',
    );
    expect(text).not.toContain("workspace-fixture");
    expect(text).not.toContain("priceMinor");
    expect(text).not.toContain("stockStatus");
    expect(text).not.toContain("assetId");
    expect(text).not.toContain("objectKey");
    expect(text).toContain("相容性只來自已核實的結構化規格");
  });
});
