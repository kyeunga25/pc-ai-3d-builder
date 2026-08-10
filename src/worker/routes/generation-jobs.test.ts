import { describe, expect, it } from "vitest";

import type { AssetGenerationParams } from "../../shared/domain/generation-jobs";
import type { WorkspaceRole } from "../../shared/domain/session";
import type { RequestContext } from "../auth/workspace";
import { createD1Stub } from "../test/d1-stub";
import {
  generationJobListResponse,
  generationJobStartResponse,
} from "./generation-jobs";

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

function assetRow(overrides: Record<string, unknown> = {}) {
  return {
    asset_id: "asset-fixture",
    part_id: "part-fixture",
    sku: "FIXTURE-001",
    manufacturer: "Fixture",
    model: "Review Part",
    status: "draft",
    quality: "draft",
    source_kind: "uploaded",
    completed_checks_json: '["source_rights"]',
    source_rights_confirmed: 1,
    verified_width_mm: null,
    verified_height_mm: null,
    verified_depth_mm: null,
    review_version: 2,
    source_object_key: "private/source-fixture",
    source_content_type: "image/png",
    source_size_bytes: 8,
    source_sha256: "a".repeat(64),
    model_object_key: null,
    model_content_type: null,
    model_size_bytes: null,
    model_sha256: null,
    ...overrides,
  };
}

function jobRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "generation-fixture",
    asset_id: "asset-fixture",
    status: "queued",
    execution_mode: "simulation",
    workflow_instance_id: "generation-fixture",
    requested_review_version: 2,
    output_object_key: null,
    failure_code: null,
    entitlement_status: "reserved",
    provider_cost_units: null,
    validation_code: null,
    created_at: "2026-08-02 00:00:00",
    updated_at: "2026-08-02 00:00:00",
    ...overrides,
  };
}

function workflowStub(instanceStatus = "unknown") {
  const creates: Array<WorkflowInstanceCreateOptions<AssetGenerationParams>> =
    [];
  const workflow = {
    async create(
      options?: WorkflowInstanceCreateOptions<AssetGenerationParams>,
    ) {
      if (options) {
        creates.push(options);
      }
      return { id: options?.id ?? "generated" } as WorkflowInstance;
    },
    async get(id: string) {
      return {
        id,
        async status() {
          return { status: instanceStatus };
        },
      } as WorkflowInstance;
    },
  } as Workflow<AssetGenerationParams>;
  return { creates, workflow };
}

function sourceBucketStub(
  options: {
    checksumByte?: number;
    contentType?: string;
    error?: Error;
    missing?: boolean;
    size?: number;
  } = {},
) {
  const heads: string[] = [];
  const bucket = {
    async head(key: string) {
      heads.push(key);
      if (options.error) {
        throw options.error;
      }
      if (options.missing) {
        return null;
      }
      return {
        checksums: {
          sha256: new Uint8Array(32).fill(options.checksumByte ?? 0xaa).buffer,
        },
        size: options.size ?? 8,
        httpMetadata: { contentType: options.contentType ?? "image/png" },
      };
    },
  } as unknown as R2Bucket;
  return { bucket, heads };
}

function request() {
  return new Request(
    "https://app.example/api/assets/asset-fixture/generation-jobs",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "request-fixture-001",
      },
      body: JSON.stringify({ expectedVersion: 2 }),
    },
  );
}

describe("generation job routes", () => {
  it("returns a disabled capability without exposing private job fields", async () => {
    const { db } = createD1Stub({
      firstResults: [
        assetRow(),
        {
          available_units: 3,
          reserved_units: 1,
          settled_units: 2,
          released_units: 4,
        },
      ],
      allResults: [
        [
          jobRow({
            status: "awaiting_review",
            output_object_key: "private/output",
            provider_cost_units: 1,
            validation_code: "GLB_VALID",
          }),
        ],
      ],
    });
    const { workflow } = workflowStub();

    const response = await generationJobListResponse(
      {
        ASSET_GENERATION: workflow,
        DB: db,
        GENERATION_MODE: "disabled",
        GENERATION_MAX_COST_MINOR: "0",
        PRIVATE_ASSETS: sourceBucketStub().bucket,
      },
      context("viewer"),
      "asset-fixture",
    );

    const body = await response.json();
    expect(body).toEqual({
      capability: {
        mode: "disabled",
        maxCostMinor: 0,
        credits: {
          availableUnits: 3,
          reservedUnits: 1,
          settledUnits: 2,
          releasedUnits: 4,
        },
      },
      items: [
        {
          id: "generation-fixture",
          assetId: "asset-fixture",
          status: "awaiting_review",
          kind: "simulation",
          outputReady: true,
          failureCode: null,
          entitlementStatus: "reserved",
          providerCostUnits: 1,
          validationCode: "GLB_VALID",
          createdAt: "2026-08-02 00:00:00",
          updatedAt: "2026-08-02 00:00:00",
        },
      ],
    });
    expect(JSON.stringify(body)).not.toContain("private/output");
  });

  it("creates one workspace-bound zero-cost job and starts its Workflow", async () => {
    const { calls, db } = createD1Stub({
      firstResults: [null, null, assetRow(), jobRow()],
    });
    const { creates, workflow } = workflowStub();

    const response = await generationJobStartResponse(
      request(),
      {
        ASSET_GENERATION: workflow,
        DB: db,
        GENERATION_MODE: "simulation",
        GENERATION_MAX_COST_MINOR: "0",
        PRIVATE_ASSETS: sourceBucketStub().bucket,
      },
      context(),
      "asset-fixture",
      "request-fixture",
    );

    expect(response.status).toBe(202);
    expect(creates).toHaveLength(1);
    expect(creates[0]?.params).toMatchObject({
      workspaceId: "workspace-fixture",
      assetId: "asset-fixture",
      requestedReviewVersion: 2,
    });
    const insert = calls.find((call) =>
      call.sql.includes("INSERT INTO generation_jobs"),
    );
    const reservation = calls.find((call) =>
      call.sql.includes("UPDATE generation_credit_accounts"),
    );
    expect(insert?.values).toContain("workspace-fixture");
    expect(insert?.values).toContain(0);
    expect(reservation?.values).toEqual([1, "workspace-fixture"]);
    expect(JSON.stringify(calls)).not.toContain("fixture@example.com");
    expect(JSON.stringify(calls)).not.toContain("private/source-fixture");
  });

  it("does not replay an idempotency key across different assets", async () => {
    const { db } = createD1Stub({ firstResults: [jobRow()] });
    const { creates, workflow } = workflowStub();

    await expect(
      generationJobStartResponse(
        request(),
        {
          ASSET_GENERATION: workflow,
          DB: db,
          GENERATION_MODE: "simulation",
          GENERATION_MAX_COST_MINOR: "0",
          PRIVATE_ASSETS: sourceBucketStub().bucket,
        },
        context(),
        "asset-other",
        "request-fixture",
      ),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_KEY_REUSED" });
    expect(creates).toHaveLength(0);
  });

  it("replays the original job without another reservation or Workflow", async () => {
    const { calls, db } = createD1Stub({
      firstResults: [jobRow({ status: "running" })],
    });
    const { creates, workflow } = workflowStub("running");

    const response = await generationJobStartResponse(
      request(),
      {
        ASSET_GENERATION: workflow,
        DB: db,
        GENERATION_MODE: "simulation",
        GENERATION_MAX_COST_MINOR: "0",
        PRIVATE_ASSETS: sourceBucketStub().bucket,
      },
      context(),
      "asset-fixture",
      "request-replay",
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      id: "generation-fixture",
      assetId: "asset-fixture",
      status: "running",
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(creates).toHaveLength(0);
    expect(calls.some((call) => /\b(?:INSERT|UPDATE)\b/u.test(call.sql))).toBe(
      false,
    );
  });

  it("recovers a missing Workflow by its existing fixed identifier", async () => {
    const { calls, db } = createD1Stub({ firstResults: [jobRow()] });
    const { creates, workflow } = workflowStub();

    const response = await generationJobStartResponse(
      request(),
      {
        ASSET_GENERATION: workflow,
        DB: db,
        GENERATION_MODE: "simulation",
        GENERATION_MAX_COST_MINOR: "0",
        PRIVATE_ASSETS: sourceBucketStub().bucket,
      },
      context(),
      "asset-fixture",
      "request-recovery",
    );

    expect(response.status).toBe(200);
    expect(creates).toEqual([
      {
        id: "generation-fixture",
        params: {
          jobId: "generation-fixture",
          workspaceId: "workspace-fixture",
          assetId: "asset-fixture",
          requestedReviewVersion: 2,
        },
      },
    ]);
    expect(calls.some((call) => /\b(?:INSERT|UPDATE)\b/u.test(call.sql))).toBe(
      false,
    );
  });

  it("blocks a second key while the same asset has an active job", async () => {
    const { calls, db } = createD1Stub({
      firstResults: [null, jobRow({ id: "generation-active" })],
    });
    const { creates, workflow } = workflowStub();

    await expect(
      generationJobStartResponse(
        request(),
        {
          ASSET_GENERATION: workflow,
          DB: db,
          GENERATION_MODE: "simulation",
          GENERATION_MAX_COST_MINOR: "0",
          PRIVATE_ASSETS: sourceBucketStub().bucket,
        },
        context(),
        "asset-fixture",
        "request-concurrent",
      ),
    ).rejects.toMatchObject({ code: "GENERATION_ALREADY_ACTIVE" });
    expect(creates).toHaveLength(0);
    expect(calls.some((call) => /\b(?:INSERT|UPDATE)\b/u.test(call.sql))).toBe(
      false,
    );
  });

  it("rejects a stale asset version before reserving credit", async () => {
    const { calls, db } = createD1Stub({
      firstResults: [null, null, assetRow({ review_version: 3 })],
    });
    const { creates, workflow } = workflowStub();

    await expect(
      generationJobStartResponse(
        request(),
        {
          ASSET_GENERATION: workflow,
          DB: db,
          GENERATION_MODE: "simulation",
          GENERATION_MAX_COST_MINOR: "0",
          PRIVATE_ASSETS: sourceBucketStub().bucket,
        },
        context(),
        "asset-fixture",
        "request-stale",
      ),
    ).rejects.toMatchObject({ code: "ASSET_VERSION_CONFLICT" });
    expect(creates).toHaveLength(0);
    expect(calls.some((call) => /\b(?:INSERT|UPDATE)\b/u.test(call.sql))).toBe(
      false,
    );
  });

  it.each([
    { label: "missing object", options: { missing: true } },
    { label: "size drift", options: { size: 7 } },
    { label: "content-type drift", options: { contentType: "image/jpeg" } },
    { label: "checksum drift", options: { checksumByte: 0xbb } },
  ])(
    "rejects generation for a $label before reserving credit",
    async ({ options }) => {
      const { calls, db } = createD1Stub({
        firstResults: [null, null, assetRow()],
      });
      const { creates, workflow } = workflowStub();
      const { bucket, heads } = sourceBucketStub(options);

      await expect(
        generationJobStartResponse(
          request(),
          {
            ASSET_GENERATION: workflow,
            DB: db,
            GENERATION_MODE: "simulation",
            GENERATION_MAX_COST_MINOR: "0",
            PRIVATE_ASSETS: bucket,
          },
          context(),
          "asset-fixture",
          "request-source-unavailable",
        ),
      ).rejects.toMatchObject({
        status: 409,
        code: "GENERATION_SOURCE_REQUIRED",
      });
      expect(heads).toEqual(["private/source-fixture"]);
      expect(creates).toHaveLength(0);
      expect(
        calls.some((call) => /\b(?:INSERT|UPDATE|DELETE)\b/u.test(call.sql)),
      ).toBe(false);
    },
  );

  it("keeps a source R2 lookup failure as an operational error", async () => {
    const storageError = new Error(
      "synthetic generation source lookup failure",
    );
    const { calls, db } = createD1Stub({
      firstResults: [null, null, assetRow()],
    });
    const { creates, workflow } = workflowStub();
    const { bucket } = sourceBucketStub({ error: storageError });

    await expect(
      generationJobStartResponse(
        request(),
        {
          ASSET_GENERATION: workflow,
          DB: db,
          GENERATION_MODE: "simulation",
          GENERATION_MAX_COST_MINOR: "0",
          PRIVATE_ASSETS: bucket,
        },
        context(),
        "asset-fixture",
        "request-source-r2-failure",
      ),
    ).rejects.toBe(storageError);
    expect(creates).toHaveLength(0);
    expect(
      calls.some((call) => /\b(?:INSERT|UPDATE|DELETE)\b/u.test(call.sql)),
    ).toBe(false);
  });

  it("rejects malformed and oversized input before database access", async () => {
    const { calls, db } = createD1Stub();
    const { creates, workflow } = workflowStub();
    const env = {
      ASSET_GENERATION: workflow,
      DB: db,
      GENERATION_MODE: "simulation",
      GENERATION_MAX_COST_MINOR: "0",
      PRIVATE_ASSETS: sourceBucketStub().bucket,
    };
    const malformed = new Request(
      "https://app.example/api/assets/asset-fixture/generation-jobs",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": "request-malformed",
        },
        body: JSON.stringify({ expectedVersion: -1 }),
      },
    );
    const oversized = new Request(
      "https://app.example/api/assets/asset-fixture/generation-jobs",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": "request-oversized",
        },
        body: JSON.stringify({
          expectedVersion: 2,
          padding: "x".repeat(32 * 1024),
        }),
      },
    );

    await expect(
      generationJobStartResponse(
        malformed,
        env,
        context(),
        "asset-fixture",
        "request-malformed",
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(
      generationJobStartResponse(
        oversized,
        env,
        context(),
        "asset-fixture",
        "request-oversized",
      ),
    ).rejects.toMatchObject({ code: "PAYLOAD_TOO_LARGE" });
    expect(calls).toHaveLength(0);
    expect(creates).toHaveLength(0);
  });

  it("requires owner or admin and a saved source-rights confirmation", async () => {
    const { db } = createD1Stub();
    const { workflow } = workflowStub();
    const env = {
      ASSET_GENERATION: workflow,
      DB: db,
      GENERATION_MODE: "simulation",
      GENERATION_MAX_COST_MINOR: "0",
      PRIVATE_ASSETS: sourceBucketStub().bucket,
    };

    await expect(
      generationJobStartResponse(
        request(),
        env,
        context("staff"),
        "asset-fixture",
        "request-fixture",
      ),
    ).rejects.toMatchObject({ code: "ROLE_FORBIDDEN" });

    const noRightsDb = createD1Stub({
      firstResults: [null, null, assetRow({ source_rights_confirmed: 0 })],
    }).db;
    await expect(
      generationJobStartResponse(
        request(),
        { ...env, DB: noRightsDb },
        context(),
        "asset-fixture",
        "request-fixture",
      ),
    ).rejects.toMatchObject({ code: "GENERATION_RIGHTS_REQUIRED" });
  });

  it("keeps production disabled before any database or Workflow write", async () => {
    const { calls, db } = createD1Stub();
    const { creates, workflow } = workflowStub();

    await expect(
      generationJobStartResponse(
        request(),
        {
          ASSET_GENERATION: workflow,
          DB: db,
          GENERATION_MODE: "disabled",
          GENERATION_MAX_COST_MINOR: "0",
          PRIVATE_ASSETS: sourceBucketStub().bucket,
        },
        context(),
        "asset-fixture",
        "request-fixture",
      ),
    ).rejects.toMatchObject({ code: "GENERATION_DISABLED" });
    expect(calls).toHaveLength(0);
    expect(creates).toHaveLength(0);
  });
});
