import { describe, expect, it } from "vitest";

import type { AssetGenerationParams } from "../../shared/domain/generation-jobs";
import type { WorkspaceRole } from "../../shared/domain/session";
import type { RequestContext } from "../auth/workspace";
import { createD1Stub } from "../test/d1-stub";
import {
  generationJobCancelResponse,
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

function request(expectedVersion = 2, assetId = "asset-fixture") {
  return new Request("https://app.example/api/assets/item/generation-jobs", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": "request-fixture-001",
      "x-rigstage-asset-id": assetId,
    },
    body: JSON.stringify({ expectedVersion }),
  });
}

function cancelRequest(
  assetId = "asset-fixture",
  jobId = "generation-fixture",
  body?: string,
) {
  return new Request("https://app.example/api/assets/item/generation-jobs", {
    method: "DELETE",
    headers: {
      "x-rigstage-asset-id": assetId,
      "x-rigstage-generation-job-id": jobId,
    },
    body,
  });
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
    const listRequest = new Request(
      "https://app.example/api/assets/item/generation-jobs",
      { headers: { "x-rigstage-asset-id": "asset-fixture" } },
    );

    const response = await generationJobListResponse(
      listRequest,
      {
        ASSET_GENERATION: workflow,
        DB: db,
        GENERATION_MODE: "disabled",
        GENERATION_MAX_COST_MINOR: "0",
        PRIVATE_ASSETS: sourceBucketStub().bucket,
      },
      context("viewer"),
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

  it.each([
    { failure_code: "private parser detail" },
    { validation_code: "GLB-VALID" },
    { failure_code: `A${"B".repeat(128)}` },
  ])("fails closed on an unsafe stored diagnostic code: %j", async (code) => {
    const { db } = createD1Stub({
      firstResults: [
        assetRow(),
        {
          available_units: 0,
          reserved_units: 0,
          settled_units: 0,
          released_units: 0,
        },
      ],
      allResults: [[jobRow({ status: "failed", ...code })]],
    });
    const { workflow } = workflowStub();

    await expect(
      generationJobListResponse(
        new Request("https://app.example/api/assets/item/generation-jobs", {
          headers: { "x-rigstage-asset-id": "asset-fixture" },
        }),
        {
          ASSET_GENERATION: workflow,
          DB: db,
          GENERATION_MODE: "disabled",
          GENERATION_MAX_COST_MINOR: "0",
          PRIVATE_ASSETS: sourceBucketStub().bucket,
        },
        context("viewer"),
      ),
    ).rejects.toThrow();
  });

  it.each([null, "../../escape"])(
    "rejects a missing or malformed job-list target before database work: %s",
    async (assetId) => {
      const { calls, db } = createD1Stub();
      const { workflow } = workflowStub();
      const headers = new Headers();
      if (assetId !== null) headers.set("x-rigstage-asset-id", assetId);
      const listRequest = new Request(
        "https://app.example/api/assets/item/generation-jobs",
        { headers },
      );

      await expect(
        generationJobListResponse(
          listRequest,
          {
            ASSET_GENERATION: workflow,
            DB: db,
            GENERATION_MODE: "disabled",
            GENERATION_MAX_COST_MINOR: "0",
            PRIVATE_ASSETS: sourceBucketStub().bucket,
          },
          context("viewer"),
        ),
      ).rejects.toMatchObject({
        status: 404,
        code: "ASSET_NOT_FOUND",
        message: "找不到所要求的素材。 / The requested asset was not found.",
      });
      expect(calls).toHaveLength(0);
    },
  );

  it.each([null, "../../escape"])(
    "rejects a missing or malformed generation target before body, D1, R2 or Workflow: %s",
    async (assetId) => {
      const { calls, db } = createD1Stub();
      const { creates, workflow } = workflowStub();
      const headers = new Headers({
        "content-type": "application/json",
        "idempotency-key": "request-target-fixture",
      });
      if (assetId !== null) headers.set("x-rigstage-asset-id", assetId);
      const startRequest = new Request(
        "https://app.example/api/assets/item/generation-jobs",
        { method: "POST", headers, body: "{malformed" },
      );

      await expect(
        generationJobStartResponse(
          startRequest,
          {
            ASSET_GENERATION: workflow,
            DB: db,
            GENERATION_MODE: "simulation",
            GENERATION_MAX_COST_MINOR: "0",
            PRIVATE_ASSETS: sourceBucketStub().bucket,
          },
          context(),
          "request-target-fixture",
        ),
      ).rejects.toMatchObject({
        status: 404,
        code: "ASSET_NOT_FOUND",
        message: "找不到所要求的素材。 / The requested asset was not found.",
      });
      expect(startRequest.bodyUsed).toBe(false);
      expect(calls).toHaveLength(0);
      expect(creates).toHaveLength(0);
    },
  );

  it("rejects staff before reading a missing target or malformed body", async () => {
    const { calls, db } = createD1Stub();
    const { creates, workflow } = workflowStub();
    const startRequest = new Request(
      "https://app.example/api/assets/item/generation-jobs",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": "request-role-fixture",
        },
        body: "{malformed",
      },
    );

    await expect(
      generationJobStartResponse(
        startRequest,
        {
          ASSET_GENERATION: workflow,
          DB: db,
          GENERATION_MODE: "simulation",
          GENERATION_MAX_COST_MINOR: "0",
          PRIVATE_ASSETS: sourceBucketStub().bucket,
        },
        context("staff"),
        "request-role-fixture",
      ),
    ).rejects.toMatchObject({
      status: 403,
      code: "ROLE_FORBIDDEN",
      message: expect.stringMatching(/owner.+admin.+Only workspace/iu),
    });
    expect(startRequest.bodyUsed).toBe(false);
    expect(calls).toHaveLength(0);
    expect(creates).toHaveLength(0);
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
        request(2, "asset-other"),
        {
          ASSET_GENERATION: workflow,
          DB: db,
          GENERATION_MODE: "simulation",
          GENERATION_MAX_COST_MINOR: "0",
          PRIVATE_ASSETS: sourceBucketStub().bucket,
        },
        context(),
        "request-fixture",
      ),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_KEY_REUSED" });
    expect(creates).toHaveLength(0);
  });

  it("does not replay an idempotency key across different review versions", async () => {
    const { calls, db } = createD1Stub({
      firstResults: [jobRow({ requested_review_version: 2 })],
    });
    const { creates, workflow } = workflowStub();

    await expect(
      generationJobStartResponse(
        request(3),
        {
          ASSET_GENERATION: workflow,
          DB: db,
          GENERATION_MODE: "simulation",
          GENERATION_MAX_COST_MINOR: "0",
          PRIVATE_ASSETS: sourceBucketStub().bucket,
        },
        context(),
        "request-version-reuse",
      ),
    ).rejects.toMatchObject({
      status: 409,
      code: "IDEMPOTENCY_KEY_REUSED",
      message: expect.stringMatching(
        /此 Idempotency-Key.+This Idempotency-Key/u,
      ),
    });
    expect(creates).toHaveLength(0);
    expect(calls.some((call) => /\b(?:INSERT|UPDATE)\b/u.test(call.sql))).toBe(
      false,
    );
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
      "https://app.example/api/assets/item/generation-jobs",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": "request-malformed",
          "x-rigstage-asset-id": "asset-fixture",
        },
        body: JSON.stringify({ expectedVersion: -1 }),
      },
    );
    const oversized = new Request(
      "https://app.example/api/assets/item/generation-jobs",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": "request-oversized",
          "x-rigstage-asset-id": "asset-fixture",
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
        "request-malformed",
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(
      generationJobStartResponse(
        oversized,
        env,
        context(),
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
        "request-fixture",
      ),
    ).rejects.toMatchObject({ code: "GENERATION_DISABLED" });
    expect(calls).toHaveLength(0);
    expect(creates).toHaveLength(0);
  });

  it("cancels one exact queued job and releases its reserved credit", async () => {
    const { calls, db } = createD1Stub({
      firstResults: [
        jobRow(),
        jobRow({ status: "cancelled", entitlement_status: "released" }),
      ],
    });

    const response = await generationJobCancelResponse(
      cancelRequest(),
      db,
      context("admin"),
      "request-cancel-fixture",
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toMatchObject({
      id: "generation-fixture",
      assetId: "asset-fixture",
      status: "cancelled",
      entitlementStatus: "released",
      outputReady: false,
    });
    const transition = calls.find((call) =>
      call.sql.includes("UPDATE generation_jobs"),
    );
    expect(transition?.sql).toContain("status = 'cancelled'");
    expect(transition?.sql).toContain("status = 'queued'");
    expect(transition?.values).toContain("workspace-fixture");
    expect(transition?.values).toContain("asset-fixture");
    expect(transition?.values).toContain("generation-fixture");
    expect(
      calls.some(
        (call) =>
          call.sql.includes("INSERT INTO audit_events") &&
          call.values.includes("generation.cancel"),
      ),
    ).toBe(true);
    expect(
      calls.some(
        (call) =>
          call.sql.includes("generation_job_entitlements") &&
          call.values.includes("user_cancelled"),
      ),
    ).toBe(true);
    expect(JSON.stringify(calls)).not.toContain("fixture@example.com");
  });

  it("replays an already-cancelled target without another credit transition", async () => {
    const { calls, db } = createD1Stub({
      firstResults: [
        jobRow({ status: "cancelled", entitlement_status: "released" }),
      ],
    });

    const response = await generationJobCancelResponse(
      cancelRequest(),
      db,
      context(),
      "request-cancel-replay",
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "cancelled",
      entitlementStatus: "released",
    });
    expect(
      calls.some((call) => /\b(?:INSERT|UPDATE|DELETE)\b/u.test(call.sql)),
    ).toBe(false);
  });

  it("loses safely when Workflow has already claimed the queued job", async () => {
    const { calls, db } = createD1Stub({
      batchChanges: 0,
      firstResults: [jobRow(), jobRow({ status: "running" })],
    });

    await expect(
      generationJobCancelResponse(
        cancelRequest(),
        db,
        context(),
        "request-cancel-race",
      ),
    ).rejects.toMatchObject({
      status: 409,
      code: "GENERATION_CANCEL_TOO_LATE",
      message: expect.stringMatching(/已開始.+already started/iu),
    });
    const transition = calls.find((call) =>
      call.sql.includes("UPDATE generation_jobs"),
    );
    expect(transition?.sql).toContain("status = 'queued'");
  });

  it.each(["running", "validating", "awaiting_review", "failed"])(
    "does not cancel a generation job in %s state",
    async (status) => {
      const { calls, db } = createD1Stub({
        firstResults: [jobRow({ status })],
      });

      await expect(
        generationJobCancelResponse(
          cancelRequest(),
          db,
          context(),
          `request-cancel-${status}`,
        ),
      ).rejects.toMatchObject({
        status: 409,
        code: "GENERATION_CANCEL_TOO_LATE",
      });
      expect(
        calls.some((call) => /\b(?:INSERT|UPDATE|DELETE)\b/u.test(call.sql)),
      ).toBe(false);
    },
  );

  it("rejects staff before reading cancellation targets or request body", async () => {
    const { calls, db } = createD1Stub();
    const cancellation = new Request(
      "https://app.example/api/assets/item/generation-jobs",
      { method: "DELETE", body: "private-input" },
    );

    await expect(
      generationJobCancelResponse(
        cancellation,
        db,
        context("staff"),
        "request-cancel-role",
      ),
    ).rejects.toMatchObject({ status: 403, code: "ROLE_FORBIDDEN" });
    expect(cancellation.bodyUsed).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it.each([
    { assetId: "../../escape", jobId: "generation-fixture" },
    { assetId: "asset-fixture", jobId: "../../escape" },
    { assetId: "asset-fixture", jobId: "" },
  ])(
    "rejects malformed cancellation targets before D1: $assetId / $jobId",
    async ({ assetId, jobId }) => {
      const { calls, db } = createD1Stub();

      await expect(
        generationJobCancelResponse(
          cancelRequest(assetId, jobId),
          db,
          context(),
          "request-cancel-target",
        ),
      ).rejects.toMatchObject({
        status: 404,
        code: "GENERATION_JOB_NOT_FOUND",
      });
      expect(calls).toHaveLength(0);
    },
  );

  it("rejects a body-bearing cancellation before D1", async () => {
    const { calls, db } = createD1Stub();
    const cancellation = cancelRequest(
      "asset-fixture",
      "generation-fixture",
      "private-input",
    );

    await expect(
      generationJobCancelResponse(
        cancellation,
        db,
        context(),
        "request-cancel-body",
      ),
    ).rejects.toMatchObject({
      status: 400,
      code: "UNEXPECTED_REQUEST_BODY",
    });
    expect(cancellation.bodyUsed).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("does not reveal or mutate a missing or cross-workspace cancellation target", async () => {
    const { calls, db } = createD1Stub({ firstResults: [null] });

    await expect(
      generationJobCancelResponse(
        cancelRequest("asset-other", "generation-other"),
        db,
        context(),
        "request-cancel-isolation",
      ),
    ).rejects.toMatchObject({
      status: 404,
      code: "GENERATION_JOB_NOT_FOUND",
    });
    expect(
      calls.some((call) => /\b(?:INSERT|UPDATE|DELETE)\b/u.test(call.sql)),
    ).toBe(false);
  });
});
