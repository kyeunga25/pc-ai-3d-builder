import { describe, expect, it } from "vitest";

import type { RequestContext } from "../auth/workspace";
import { catalogueResponse, parseCatalogueOptions } from "./catalogue";

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
    role: "owner",
  },
  workspaces: [],
};

function fakeDatabase(rows: Array<Record<string, unknown>>) {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const db = {
    prepare(sql: string) {
      return {
        bind(...values: unknown[]) {
          calls.push({ sql, values });
          return {
            async all() {
              return { success: true, results: rows };
            },
          };
        },
      };
    },
  } as unknown as D1Database;

  return { calls, db };
}

describe("catalogue route", () => {
  it("rejects invalid or unbounded pagination values", () => {
    expect(() =>
      parseCatalogueOptions(
        new URL("https://app.example/api/catalogue?limit=101"),
      ),
    ).toThrowError(expect.objectContaining({ code: "VALIDATION_ERROR" }));
    expect(() =>
      parseCatalogueOptions(
        new URL("https://app.example/api/catalogue?cursor=part-private"),
      ),
    ).toThrowError(
      expect.objectContaining({
        code: "VALIDATION_ERROR",
        message: "產品目錄篩選條件無效。 / The catalogue filters are invalid.",
      }),
    );
    expect(() =>
      parseCatalogueOptions(
        new URL("https://app.example/api/catalogue"),
        "../../escape",
      ),
    ).toThrowError(expect.objectContaining({ code: "VALIDATION_ERROR" }));
  });

  it("scopes catalogue reads to the verified workspace", async () => {
    const { calls, db } = fakeDatabase([
      {
        id: "part-fixture",
        sku: "FIXTURE-001",
        category: "case",
        manufacturer: "Fixture",
        model: "Case",
        price_minor: 100_00,
        stock_status: "in_stock",
        stock_count: 2,
        specifications_json: '{"formFactor":"ATX"}',
        specification_status: "verified",
        status: "active",
        record_version: 3,
        asset_id: "asset-fixture",
        asset_quality: "approved",
        asset_review_status: "approved",
      },
    ]);

    const response = await catalogueResponse(
      db,
      context,
      new Request("https://app.example/api/catalogue?limit=20&category=case"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toMatchObject({
      items: [
        {
          id: "part-fixture",
          assetStatus: "approved",
          verified: true,
          specifications: { formFactor: "ATX" },
          version: 3,
        },
      ],
      nextCursor: null,
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.sql).toContain("p.workspace_id = ?");
    expect(calls[0]?.values).toEqual(["workspace-fixture", "case", 21]);
  });

  it("uses a workspace-bound cursor and returns the next page token", async () => {
    const rows = Array.from({ length: 3 }, (_, index) => ({
      id: `part-${index + 1}`,
      sku: `FIXTURE-${index + 1}`,
      category: "gpu",
      manufacturer: "Fixture",
      model: `GPU ${index + 1}`,
      price_minor: 0,
      stock_status: "unknown",
      stock_count: null,
      specifications_json: "{}",
      specification_status: "unverified",
      status: "active",
      record_version: 0,
      asset_id: null,
      asset_quality: null,
      asset_review_status: null,
    }));
    const { calls, db } = fakeDatabase(rows);

    const response = await catalogueResponse(
      db,
      context,
      new Request("https://app.example/api/catalogue?limit=2", {
        headers: { "x-rigstage-catalogue-cursor": "part-0" },
      }),
    );
    const body = await response.json();

    expect(body).toMatchObject({
      items: [{ id: "part-1" }, { id: "part-2" }],
      nextCursor: "part-2",
    });
    expect(calls[0]?.values).toEqual(["workspace-fixture", "part-0", 3]);
  });
});
