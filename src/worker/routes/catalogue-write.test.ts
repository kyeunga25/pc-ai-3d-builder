import { describe, expect, it } from "vitest";

import type { WorkspaceRole } from "../../shared/domain/session";
import type { RequestContext } from "../auth/workspace";
import { createD1Stub } from "../test/d1-stub";
import {
  catalogueCreateResponse,
  catalogueImportResponse,
  catalogueMutationResponse,
  parseCatalogueCsv,
} from "./catalogue-write";

const validCsv = `sku,category,manufacturer,model,price_hkd,stock_status,stock_count,specification_status,specifications_json
CASE-001,case,Fixture,"Compact, Case",849.00,in_stock,6,verified,"{""formFactor"":""ATX""}"`;

function context(role: WorkspaceRole): RequestContext {
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

const catalogueRow = {
  id: "part-fixture",
  sku: "CASE-001",
  category: "case",
  manufacturer: "Fixture",
  model: "Compact Case",
  price_minor: 84_900,
  stock_status: "in_stock",
  stock_count: 6,
  specifications_json: '{"formFactor":"ATX"}',
  specification_status: "verified",
  status: "active",
  record_version: 0,
  asset_id: null,
  asset_quality: null,
  asset_review_status: null,
};

describe("catalogue CSV import", () => {
  it("parses quoted fields and validated structured specifications", () => {
    expect(parseCatalogueCsv(validCsv)).toEqual([
      {
        sku: "CASE-001",
        category: "case",
        manufacturer: "Fixture",
        model: "Compact, Case",
        priceMinor: 84_900,
        stockStatus: "in_stock",
        stockCount: 6,
        specificationStatus: "verified",
        specifications: { formFactor: "ATX" },
      },
    ]);
  });

  it("rejects duplicate SKUs and inconsistent stock values", () => {
    expect(() =>
      parseCatalogueCsv(`${validCsv}
case-001,case,Fixture,Second Case,799.00,in_stock,2,verified,{}`),
    ).toThrowError(expect.objectContaining({ code: "CATALOGUE_SKU_CONFLICT" }));

    expect(() =>
      parseCatalogueCsv(validCsv.replace(",in_stock,6,", ",out_of_stock,6,")),
    ).toThrowError(expect.objectContaining({ code: "VALIDATION_ERROR" }));
  });
});

describe("catalogue writes", () => {
  it("rejects viewer mutations before database work", async () => {
    const { calls, db } = createD1Stub();
    const request = new Request("https://app.example/api/catalogue", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sku: "CASE-001",
        category: "case",
        manufacturer: "Fixture",
        model: "Compact Case",
        priceMinor: 84_900,
        stockStatus: "in_stock",
        stockCount: 6,
        specificationStatus: "verified",
        specifications: {},
      }),
    });

    await expect(
      catalogueCreateResponse(
        request,
        db,
        context("viewer"),
        "request-fixture",
      ),
    ).rejects.toMatchObject({ code: "ROLE_FORBIDDEN" });
    expect(calls).toHaveLength(0);
  });

  it("creates a workspace-scoped row and minimal audit event", async () => {
    const { calls, db } = createD1Stub({
      firstResults: [null, catalogueRow],
    });
    const request = new Request("https://app.example/api/catalogue", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sku: "CASE-001",
        category: "case",
        manufacturer: "Fixture",
        model: "Compact Case",
        priceMinor: 84_900,
        stockStatus: "in_stock",
        stockCount: 6,
        specificationStatus: "verified",
        specifications: { formFactor: "ATX" },
      }),
    });

    const response = await catalogueCreateResponse(
      request,
      db,
      context("staff"),
      "request-fixture",
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      id: "part-fixture",
      sku: "CASE-001",
      specifications: { formFactor: "ATX" },
      version: 0,
    });
    expect(calls.some((call) => call.sql.includes("workspace_id = ?1"))).toBe(
      true,
    );
    expect(
      calls.some(
        (call) =>
          call.sql.includes("INSERT INTO audit_events") &&
          call.values.includes("catalogue.part.create") &&
          call.sql.includes("changes() = 1"),
      ),
    ).toBe(true);
  });

  it("rejects a stale update version without overwriting the row", async () => {
    const { db } = createD1Stub({
      batchChanges: 0,
      firstResults: [null, { ...catalogueRow, record_version: 2 }],
    });
    const request = new Request(
      "https://app.example/api/catalogue/part-fixture",
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "update",
          expectedVersion: 0,
          sku: "CASE-001",
          category: "case",
          manufacturer: "Fixture",
          model: "Compact Case",
          priceMinor: 84_900,
          stockStatus: "in_stock",
          stockCount: 6,
          specificationStatus: "verified",
          specifications: { formFactor: "ATX" },
        }),
      },
    );

    await expect(
      catalogueMutationResponse(
        request,
        db,
        context("owner"),
        "part-fixture",
        "request-fixture",
      ),
    ).rejects.toMatchObject({ code: "CATALOGUE_VERSION_CONFLICT" });
  });

  it("submits an imported row and its audit event in the same batch", async () => {
    const { calls, db } = createD1Stub({
      firstResults: [null],
      allResults: [[catalogueRow]],
    });
    const request = new Request("https://app.example/api/catalogue/import", {
      method: "POST",
      headers: { "content-type": "text/csv; charset=utf-8" },
      body: validCsv,
    });

    const response = await catalogueImportResponse(
      request,
      db,
      context("admin"),
      "request-fixture",
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      created: [{ sku: "CASE-001", version: 0 }],
    });
    expect(
      calls.filter((call) => call.sql.includes("INSERT INTO catalog_parts")),
    ).toHaveLength(1);
    expect(
      calls.filter(
        (call) =>
          call.sql.includes("INSERT INTO audit_events") &&
          call.values.includes("catalogue.part.import"),
      ),
    ).toHaveLength(1);
  });

  it("rejects a CSV media-type prefix spoof before database work", async () => {
    const { calls, db } = createD1Stub();
    const request = new Request("https://app.example/api/catalogue/import", {
      method: "POST",
      headers: { "content-type": "text/csv-malicious" },
      body: validCsv,
    });

    await expect(
      catalogueImportResponse(
        request,
        db,
        context("admin"),
        "request-media-type-spoof",
      ),
    ).rejects.toMatchObject({
      status: 415,
      code: "UNSUPPORTED_MEDIA_TYPE",
    });
    expect(request.bodyUsed).toBe(false);
    expect(calls).toHaveLength(0);
  });
});
