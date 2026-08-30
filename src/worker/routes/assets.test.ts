import { describe, expect, it } from "vitest";

import {
  assetReviewChecks,
  type AssetReviewMutation,
} from "../../shared/domain/assets";
import { createSyntheticDraftGlb } from "../../shared/domain/synthetic-glb";
import type { WorkspaceRole } from "../../shared/domain/session";
import { assetReviewCursorHeader } from "../../shared/lib/asset-review-pagination";
import type { RequestContext } from "../auth/workspace";
import { sha256Hex } from "../lib/digest";
import {
  decodeAssetReviewCursor,
  encodeAssetReviewCursor,
} from "../lib/asset-review-cursor";
import {
  assetDetailResponse,
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

const modelBytes = createSyntheticDraftGlb();
const modelSha256 = await sha256Hex(modelBytes);

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
  source_object_key: "private/source-fixture",
  source_content_type: "image/png",
  source_size_bytes: 128,
  source_sha256: "a".repeat(64),
  model_object_key: "private/model-fixture",
  model_content_type: "model/gltf-binary",
  model_size_bytes: modelBytes.byteLength,
  model_sha256: modelSha256,
  asset_updated_at: "2026-08-30 00:00:00",
};

const privateAssets = {
  async get() {
    return {
      size: modelBytes.byteLength,
      httpMetadata: { contentType: "model/gltf-binary" },
      async arrayBuffer() {
        return modelBytes.buffer.slice(
          modelBytes.byteOffset,
          modelBytes.byteOffset + modelBytes.byteLength,
        );
      },
    };
  },
} as unknown as R2Bucket;

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
  options: {
    changes?: number;
    firstRows?: Array<Record<string, unknown> | null>;
    rows?: Array<Record<string, unknown>>;
  } = {},
) {
  const prepared: FakeStatement[] = [];
  const batches: FakeStatement[][] = [];
  const batchChanges: number[][] = [];
  const rows = options.rows ?? [assetRow];
  let firstCall = 0;
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
          if (options.firstRows) {
            const row = options.firstRows[firstCall] ?? null;
            firstCall += 1;
            return row;
          }
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
  it("returns safe asset detail from a workspace-bound lookup", async () => {
    const { db, prepared } = fakeDatabase();
    const request = new Request("https://app.example/api/assets/item", {
      headers: { "x-rigstage-asset-id": "asset-fixture" },
    });

    const response = await assetDetailResponse(request, db, context("viewer"));
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(prepared[0]?.values).toEqual(["workspace-fixture", "asset-fixture"]);
    expect(text).not.toContain("private/source-fixture");
    expect(text).not.toContain("source_sha256");
    expect(text).not.toContain("workspace-fixture");
  });

  it("treats an asset outside the resolved workspace as not found", async () => {
    const { db, prepared } = fakeDatabase({ rows: [] });
    const request = new Request("https://app.example/api/assets/item", {
      headers: { "x-rigstage-asset-id": "asset-foreign" },
    });

    await expect(
      assetDetailResponse(request, db, context("viewer")),
    ).rejects.toMatchObject({ status: 404, code: "ASSET_NOT_FOUND" });
    expect(prepared[0]?.values).toEqual(["workspace-fixture", "asset-foreign"]);
  });

  it.each([null, "../../escape"])(
    "rejects a missing or malformed asset target before detail database work: %s",
    async (assetId) => {
      const { db, prepared } = fakeDatabase();
      const headers = new Headers();
      if (assetId !== null) headers.set("x-rigstage-asset-id", assetId);
      const request = new Request("https://app.example/api/assets/item", {
        headers,
      });

      await expect(
        assetDetailResponse(request, db, context("viewer")),
      ).rejects.toMatchObject({
        status: 404,
        code: "ASSET_NOT_FOUND",
        message: "找不到所要求的素材。 / The requested asset was not found.",
      });
      expect(prepared).toHaveLength(0);
    },
  );

  it("returns only one bounded workspace review page and an opaque continuation", async () => {
    const rows = Array.from({ length: 51 }, (_, index) => ({
      ...assetRow,
      asset_id: `asset-fixture-${String(index).padStart(3, "0")}`,
      part_id: `part-fixture-${String(index).padStart(3, "0")}`,
      sku: `FIXTURE-${String(index).padStart(3, "0")}`,
      status: "in_review",
      quality: "draft",
      asset_updated_at: `2026-08-30 00:00:${String(index).padStart(2, "0")}`,
    }));
    const { db, prepared } = fakeDatabase({
      rows,
    });
    const request = new Request("https://app.example/api/assets/review-queue");

    const response = await assetReviewQueueResponse(request, db, context());

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    const body = (await response.json()) as {
      items: Array<{ id: string }>;
      nextCursor: string | null;
    };
    expect(body.items).toHaveLength(50);
    expect(body.items.at(-1)?.id).toBe("asset-fixture-049");
    expect(decodeAssetReviewCursor(body.nextCursor ?? "")).toEqual({
      assetId: "asset-fixture-049",
      updatedAt: "2026-08-30 00:00:49",
    });
    expect(prepared[0]?.sql).toContain("a.workspace_id = ?1");
    expect(prepared[0]?.sql).toContain("LIMIT ?2");
    expect(prepared[0]?.values).toEqual(["workspace-fixture", 51]);
  });

  it("validates a replayable cursor in the workspace before composite seeking", async () => {
    const cursor = encodeAssetReviewCursor({
      assetId: "asset-cursor-fixture",
      updatedAt: "2026-08-30 00:10:00",
    });
    const { db, prepared } = fakeDatabase({
      firstRows: [{ available: 1 }],
      rows: [
        {
          ...assetRow,
          asset_id: "asset-next-fixture",
          asset_updated_at: "2026-08-30 00:11:00",
        },
      ],
    });
    const request = new Request("https://app.example/api/assets/review-queue", {
      headers: { [assetReviewCursorHeader]: cursor },
    });

    const response = await assetReviewQueueResponse(request, db, context());

    await expect(response.json()).resolves.toMatchObject({
      items: [{ id: "asset-next-fixture" }],
      nextCursor: null,
    });
    expect(prepared[0]?.sql).toContain("workspace_id = ?1 AND id = ?2");
    expect(prepared[0]?.values).toEqual([
      "workspace-fixture",
      "asset-cursor-fixture",
    ]);
    expect(prepared[1]?.sql).toContain("a.updated_at > ?2");
    expect(prepared[1]?.sql).toContain("a.id > ?3");
    expect(prepared[1]?.values).toEqual([
      "workspace-fixture",
      "2026-08-30 00:10:00",
      "asset-cursor-fixture",
      51,
    ]);
  });

  it.each([
    ["URL cursor", "?cursor=asset-private", null],
    ["malformed header", "", "invalid/cursor"],
  ])(
    "rejects a %s before queue database work",
    async (_label, query, cursor) => {
      const { db, prepared } = fakeDatabase();
      const headers = new Headers();
      if (cursor !== null) headers.set(assetReviewCursorHeader, cursor);
      const request = new Request(
        `https://app.example/api/assets/review-queue${query}`,
        { headers },
      );

      await expect(
        assetReviewQueueResponse(request, db, context()),
      ).rejects.toMatchObject({ status: 400, code: "VALIDATION_ERROR" });
      expect(prepared).toHaveLength(0);
    },
  );

  it("rejects a syntactically valid foreign cursor after one workspace lookup", async () => {
    const cursor = encodeAssetReviewCursor({
      assetId: "asset-foreign-fixture",
      updatedAt: "2026-08-30 00:10:00",
    });
    const { db, prepared } = fakeDatabase({ firstRows: [null] });
    const request = new Request("https://app.example/api/assets/review-queue", {
      headers: { [assetReviewCursorHeader]: cursor },
    });

    await expect(
      assetReviewQueueResponse(request, db, context()),
    ).rejects.toMatchObject({ status: 400, code: "VALIDATION_ERROR" });
    expect(prepared).toHaveLength(1);
    expect(prepared[0]?.values).toEqual([
      "workspace-fixture",
      "asset-foreign-fixture",
    ]);
  });

  it("rejects viewer review mutations before reading or private work", async () => {
    const { batches, db, prepared } = fakeDatabase();
    let privateReads = 0;
    const privateAssetsSpy = {
      async get() {
        privateReads += 1;
        return null;
      },
    } as unknown as R2Bucket;
    const request = new Request("https://app.example/api/assets/item/review", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: "{malformed",
    });

    await expect(
      assetReviewMutationResponse(
        request,
        db,
        privateAssetsSpy,
        context("viewer"),
        "request-viewer-denied",
      ),
    ).rejects.toMatchObject({
      status: 403,
      code: "ROLE_FORBIDDEN",
      message: expect.stringMatching(/你目前.+Your current workspace role/u),
    });
    expect(request.bodyUsed).toBe(false);
    expect(prepared).toHaveLength(0);
    expect(batches).toHaveLength(0);
    expect(privateReads).toBe(0);
  });

  it.each([null, "../../escape"])(
    "rejects a missing or malformed review target before body, D1 or R2 work: %s",
    async (assetId) => {
      const { batches, db, prepared } = fakeDatabase();
      let privateReads = 0;
      const privateAssetsSpy = {
        async get() {
          privateReads += 1;
          return null;
        },
      } as unknown as R2Bucket;
      const headers = new Headers({ "content-type": "application/json" });
      if (assetId !== null) headers.set("x-rigstage-asset-id", assetId);
      const request = new Request(
        "https://app.example/api/assets/item/review",
        {
          method: "PATCH",
          headers,
          body: "{malformed",
        },
      );

      await expect(
        assetReviewMutationResponse(
          request,
          db,
          privateAssetsSpy,
          context("staff"),
          "request-target-denied",
        ),
      ).rejects.toMatchObject({
        status: 404,
        code: "ASSET_NOT_FOUND",
        message: "找不到所要求的素材。 / The requested asset was not found.",
      });
      expect(request.bodyUsed).toBe(false);
      expect(prepared).toHaveLength(0);
      expect(batches).toHaveLength(0);
      expect(privateReads).toBe(0);
    },
  );

  it("updates the asset, review history and audit log in one workspace-bound batch", async () => {
    const { batches, db } = fakeDatabase();
    const request = new Request("https://app.example/api/assets/item/review", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-rigstage-asset-id": "asset-fixture",
      },
      body: JSON.stringify(reviewInput()),
    });

    const response = await assetReviewMutationResponse(
      request,
      db,
      privateAssets,
      context(),
      "request-fixture",
    );

    expect(response.status).toBe(200);
    expect(batches).toHaveLength(1);
    expect(batches[0]).toHaveLength(3);
    expect(batches[0]?.[0]?.sql).toContain("workspace_id = ?10");
    expect(batches[0]?.[0]?.values[9]).toBe("workspace-fixture");
    expect(batches[0]?.[2]?.sql).toContain("INSERT INTO audit_events");
    expect(batches[0]?.[1]?.sql).toContain("changes() = 1");
    expect(batches[0]?.[2]?.sql).toContain("changes() = 1");
    expect(batches[0]?.[2]?.values).toContain("request-fixture");
    expect(
      JSON.stringify(batches[0]?.map((statement) => statement.values)),
    ).not.toContain("fixture@example.com");
  });

  it("requires a private GLB record before approval", async () => {
    const { db } = fakeDatabase({
      rows: [{ ...assetRow, model_object_key: null }],
    });
    const request = new Request("https://app.example/api/assets/item/review", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-rigstage-asset-id": "asset-fixture",
      },
      body: JSON.stringify(reviewInput()),
    });

    await expect(
      assetReviewMutationResponse(
        request,
        db,
        privateAssets,
        context(),
        "request-fixture",
      ),
    ).rejects.toMatchObject({
      status: 409,
      code: "ASSET_MODEL_REQUIRED",
    });
  });

  it("does not collapse an R2 lookup failure into a missing-model conflict", async () => {
    const { batches, db } = fakeDatabase();
    const unavailableAssets = {
      async get() {
        throw new Error("Synthetic R2 lookup unavailable.");
      },
    } as unknown as R2Bucket;
    const request = new Request("https://app.example/api/assets/item/review", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-rigstage-asset-id": "asset-fixture",
      },
      body: JSON.stringify(reviewInput()),
    });

    await expect(
      assetReviewMutationResponse(
        request,
        db,
        unavailableAssets,
        context(),
        "request-fixture",
      ),
    ).rejects.toThrowError("Synthetic R2 lookup unavailable.");
    expect(batches).toHaveLength(0);
  });

  it("rejects a stale review version without appending state transitions", async () => {
    const { batchChanges, db } = fakeDatabase({ changes: 0 });
    const request = new Request("https://app.example/api/assets/item/review", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-rigstage-asset-id": "asset-fixture",
      },
      body: JSON.stringify(reviewInput()),
    });

    await expect(
      assetReviewMutationResponse(
        request,
        db,
        privateAssets,
        context(),
        "request-fixture",
      ),
    ).rejects.toMatchObject({
      status: 409,
      code: "ASSET_VERSION_CONFLICT",
    });
    expect(batchChanges).toEqual([[0, 0, 0]]);
  });
});
