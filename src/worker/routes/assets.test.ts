import { describe, expect, it } from "vitest";

import {
  assetReviewChecks,
  type AssetReviewMutation,
} from "../../shared/domain/assets";
import type { WorkspaceRole } from "../../shared/domain/session";
import type { RequestContext } from "../auth/workspace";
import {
  assetReviewMutationResponse,
  assetReviewQueueResponse,
  resolveReviewTransition,
} from "./assets";

type FakeStatement = {
  sql: string;
  values: unknown[];
  bind: (...values: unknown[]) => FakeStatement;
  all: () => Promise<{
    success: true;
    results: Array<Record<string, unknown>>;
  }>;
  first: () => Promise<Record<string, unknown> | null>;
};

const assetRow = {
  asset_id: "asset-fixture",
  part_id: "part-fixture",
  sku: "FIXTURE-001",
  manufacturer: "Fixture",
  model: "Review Part",
  status: "approved",
  quality: "approved",
  source_kind: "synthetic",
  completed_checks_json: JSON.stringify(assetReviewChecks),
  source_rights_confirmed: 1,
  verified_width_mm: 100,
  verified_height_mm: 200,
  verified_depth_mm: 300,
  review_version: 1,
};

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

function reviewInput(
  overrides: Partial<AssetReviewMutation> = {},
): AssetReviewMutation {
  return {
    action: "approve",
    expectedVersion: 0,
    completedChecks: [...assetReviewChecks],
    dimensionsMm: { width: 100, height: 200, depth: 300 },
    ...overrides,
  };
}

function fakeDatabase(
  options: { changes?: number; rows?: (typeof assetRow)[] } = {},
) {
  const prepared: FakeStatement[] = [];
  const batches: FakeStatement[][] = [];
  const batchChanges: number[][] = [];
  const rows = options.rows ?? [assetRow];
  const db = {
    prepare(sql: string) {
      const statement: FakeStatement = {
        sql,
        values: [],
        bind(...values: unknown[]) {
          statement.values = values;
          return statement;
        },
        async all() {
          return { success: true as const, results: rows };
        },
        async first() {
          return rows[0] ?? null;
        },
      };
      prepared.push(statement);
      return statement;
    },
    async batch(statements: FakeStatement[]) {
      batches.push(statements);
      const updateChanges = options.changes ?? 1;
      const changes = statements.map(() => (updateChanges === 1 ? 1 : 0));
      batchChanges.push(changes);
      return statements.map((_, index) => ({
        success: true,
        meta: { changes: changes[index] },
        results: [],
      }));
    },
  } as unknown as D1Database;

  return { batchChanges, batches, db, prepared };
}

describe("asset review business rules", () => {
  it("requires every checklist item and verified dimension for approval", () => {
    expect(() =>
      resolveReviewTransition(
        "owner",
        reviewInput({ completedChecks: ["model_identity"] }),
      ),
    ).toThrowError(
      expect.objectContaining({ code: "ASSET_APPROVAL_INCOMPLETE" }),
    );
  });

  it("allows staff to save drafts but reserves decisions for admins and owners", () => {
    expect(
      resolveReviewTransition(
        "staff",
        reviewInput({ action: "save_draft", completedChecks: [] }),
      ),
    ).toEqual({ status: "draft", quality: "draft" });
    expect(() => resolveReviewTransition("staff", reviewInput())).toThrowError(
      expect.objectContaining({ code: "ROLE_FORBIDDEN" }),
    );
    expect(() =>
      resolveReviewTransition("viewer", reviewInput({ action: "save_draft" })),
    ).toThrowError(expect.objectContaining({ code: "ROLE_FORBIDDEN" }));
  });
});

describe("asset review routes", () => {
  it("returns only the verified workspace review queue", async () => {
    const { db, prepared } = fakeDatabase({
      rows: [{ ...assetRow, status: "in_review", quality: "draft" }],
    });

    const response = await assetReviewQueueResponse(db, context());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      items: [{ id: "asset-fixture", version: 1 }],
    });
    expect(prepared[0]?.sql).toContain("a.workspace_id = ?1");
    expect(prepared[0]?.values).toEqual(["workspace-fixture"]);
  });

  it("updates the asset, review history and audit log in one workspace-bound batch", async () => {
    const { batches, db } = fakeDatabase();
    const request = new Request(
      "https://app.example/api/assets/asset-fixture/review",
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(reviewInput()),
      },
    );

    const response = await assetReviewMutationResponse(
      request,
      db,
      context(),
      "asset-fixture",
      "request-fixture",
    );

    expect(response.status).toBe(200);
    expect(batches).toHaveLength(1);
    expect(batches[0]).toHaveLength(3);
    expect(batches[0]?.[0]?.sql).toContain("workspace_id = ?10");
    expect(batches[0]?.[0]?.values[9]).toBe("workspace-fixture");
    expect(batches[0]?.[2]?.sql).toContain("INSERT INTO audit_events");
    expect(batches[0]?.[2]?.values).toContain("request-fixture");
    expect(
      JSON.stringify(batches[0]?.map((statement) => statement.values)),
    ).not.toContain("fixture@example.com");
  });

  it("rejects a stale review version without appending state transitions", async () => {
    const { batchChanges, db } = fakeDatabase({ changes: 0 });
    const request = new Request(
      "https://app.example/api/assets/asset-fixture/review",
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(reviewInput()),
      },
    );

    await expect(
      assetReviewMutationResponse(
        request,
        db,
        context(),
        "asset-fixture",
        "request-fixture",
      ),
    ).rejects.toMatchObject({
      status: 409,
      code: "ASSET_VERSION_CONFLICT",
    });
    expect(batchChanges).toEqual([[0, 0, 0]]);
  });
});
