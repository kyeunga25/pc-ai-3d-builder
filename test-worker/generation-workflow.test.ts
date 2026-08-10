import { introspectWorkflow } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import { assetReviewChecks } from "../src/shared/domain/assets";
import type { AssetGenerationParams } from "../src/shared/domain/generation-jobs";
import { validateGeneratedGlb } from "../src/shared/domain/glb-validation";
import { createSyntheticDraftGlb } from "../src/shared/domain/synthetic-glb";
import type { RequestContext } from "../src/worker/auth/workspace";
import { generationOutputRequirements } from "../src/worker/generation/provider";
import { sha256Hex } from "../src/worker/lib/digest";
import { assetReviewMutationResponse } from "../src/worker/routes/assets";
import { generationJobStartResponse } from "../src/worker/routes/generation-jobs";
import {
  markGenerationFailed,
  stageGeneratedDraft,
} from "../src/worker/workflows/asset-generation";

const workspaceId = "workspace-local-generation";
const userId = "user-local-generation";
const partId = "part-local-generation";
const assetId = "asset-local-generation";
const sourceBytes = new Uint8Array(128);
sourceBytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const sourceSha256 = await sha256Hex(sourceBytes);

type GenerationFixture = {
  workspaceId: string;
  userId: string;
  partId: string;
  assetId: string;
  sourceSha256: string;
  slug: string;
  idempotencyKey: string;
};

const defaultFixture: GenerationFixture = {
  workspaceId,
  userId,
  partId,
  assetId,
  sourceSha256,
  slug: "local-generation",
  idempotencyKey: "local-generation-request-001",
};

function sourceObjectKey(fixture: GenerationFixture): string {
  return `workspaces/${fixture.workspaceId}/assets/${fixture.assetId}/source/fixture`;
}

const context: RequestContext = {
  user: {
    id: userId,
    email: "local-fixture@example.invalid",
    displayName: "Local Fixture",
  },
  currentWorkspace: {
    id: workspaceId,
    slug: "local-generation",
    name: "Local Generation",
    locale: "zh-Hant-HK",
    currency: "HKD",
    role: "owner",
  },
  workspaces: [],
};

function generationRequest(
  fixture: GenerationFixture = defaultFixture,
): Request {
  return new Request(
    `https://local.invalid/api/assets/${fixture.assetId}/generation-jobs`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": fixture.idempotencyKey,
      },
      body: JSON.stringify({ expectedVersion: 2 }),
    },
  );
}

function reviewRequest(
  action: "approve" | "reject",
  fixture: GenerationFixture = defaultFixture,
): Request {
  return new Request(`https://local.invalid/api/assets/${fixture.assetId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action,
      expectedVersion: 3,
      completedChecks: action === "approve" ? assetReviewChecks : [],
      dimensionsMm:
        action === "approve"
          ? { width: 129, height: 162, depth: 138 }
          : { width: null, height: null, depth: null },
    }),
  });
}

function requestContextFor(fixture: GenerationFixture): RequestContext {
  return {
    user: {
      id: fixture.userId,
      email: `${fixture.userId}@example.invalid`,
      displayName: "Local Fixture",
    },
    currentWorkspace: {
      id: fixture.workspaceId,
      slug: fixture.slug,
      name: "Local Generation",
      locale: "zh-Hant-HK",
      currency: "HKD",
      role: "owner",
    },
    workspaces: [],
  };
}

function databaseWithBeforeBatch(beforeBatch: () => Promise<void>): D1Database {
  let pending = true;
  return {
    prepare(query: string) {
      return env.DB.prepare(query);
    },
    async batch<T = unknown>(statements: D1PreparedStatement[]) {
      if (pending) {
        pending = false;
        await beforeBatch();
      }
      return env.DB.batch<T>(statements);
    },
  } as D1Database;
}

async function seedGenerationFixture(
  fixture: GenerationFixture = defaultFixture,
): Promise<void> {
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO workspaces (id, slug, name)
       VALUES (?1, ?2, ?3)`,
    ).bind(fixture.workspaceId, fixture.slug, "Local Generation"),
    env.DB.prepare(
      `INSERT INTO users (id, email, display_name, last_workspace_id)
       VALUES (?1, ?2, ?3, ?4)`,
    ).bind(
      fixture.userId,
      `${fixture.userId}@example.invalid`,
      "Local Fixture",
      fixture.workspaceId,
    ),
    env.DB.prepare(
      `INSERT INTO workspace_memberships (workspace_id, user_id, role)
       VALUES (?1, ?2, 'owner')`,
    ).bind(fixture.workspaceId, fixture.userId),
    env.DB.prepare(
      `INSERT INTO catalog_parts (
         id, workspace_id, sku, category, manufacturer, model,
         specifications_json, specification_status, created_by, updated_by
       ) VALUES (?1, ?2, ?3, 'cooling', ?4, ?5, ?6, 'verified', ?7, ?7)`,
    ).bind(
      fixture.partId,
      fixture.workspaceId,
      "LOCAL-GENERATION-001",
      "Fixture",
      "Synthetic Cooler",
      JSON.stringify({ coolerHeightMm: 162 }),
      fixture.userId,
    ),
    env.DB.prepare(
      `INSERT INTO product_assets (
         id, workspace_id, catalog_part_id, status, quality, source_kind,
         completed_checks_json, source_rights_confirmed, review_version,
         source_object_key, source_content_type, source_size_bytes,
         source_sha256, created_by, updated_by
       ) VALUES (
         ?1, ?2, ?3, 'draft', 'draft', 'uploaded', ?4, 1, 2,
         ?5, 'image/png', 128, ?6, ?7, ?7
       )`,
    ).bind(
      fixture.assetId,
      fixture.workspaceId,
      fixture.partId,
      JSON.stringify(["source_rights"]),
      sourceObjectKey(fixture),
      fixture.sourceSha256,
      fixture.userId,
    ),
    env.DB.prepare(
      `INSERT INTO generation_credit_accounts (workspace_id, available_units)
       VALUES (?1, 2)`,
    ).bind(fixture.workspaceId),
  ]);
  await env.PRIVATE_ASSETS.put(sourceObjectKey(fixture), sourceBytes, {
    httpMetadata: { contentType: "image/png", cacheControl: "no-store" },
  });
}

describe("local generation Workflow", () => {
  it("reserves once, retries safely, validates private GLB, and settles on approval", async () => {
    await seedGenerationFixture();
    const introspector = await introspectWorkflow(env.ASSET_GENERATION);
    try {
      await introspector.modifyAll(async (modifier) => {
        await modifier.disableRetryDelays();
        await modifier.mockStepError(
          { name: "validate stored draft" },
          new Error("Synthetic transient read failure."),
          1,
        );
      });

      const response = await generationJobStartResponse(
        generationRequest(),
        env,
        context,
        assetId,
        "request-local-generation",
      );
      expect(response.status).toBe(202);
      const created = (await response.json()) as { id: string };

      const instances = await introspector.get();
      expect(instances).toHaveLength(1);
      const instance = instances[0]!;
      await expect(instance.waitForStatus("complete")).resolves.not.toThrow();
      expect(await instance.getOutput()).toEqual({
        jobId: created.id,
        status: "awaiting_review",
      });

      const job = await env.DB.prepare(
        `SELECT status, output_object_key, output_sha256,
                provider_cost_units, validation_code
         FROM generation_jobs
         WHERE workspace_id = ?1 AND id = ?2`,
      )
        .bind(workspaceId, created.id)
        .first<{
          status: string;
          output_object_key: string;
          output_sha256: string;
          provider_cost_units: number;
          validation_code: string;
        }>();
      expect(job).toMatchObject({
        status: "awaiting_review",
        provider_cost_units: 1,
        validation_code: "GLB_VALID",
      });

      const privateObject = await env.PRIVATE_ASSETS.get(
        job!.output_object_key,
      );
      expect(privateObject?.httpMetadata?.contentType).toBe(
        "model/gltf-binary",
      );
      expect(privateObject?.checksums.sha256).toBeDefined();
      const outputBytes = new Uint8Array(await privateObject!.arrayBuffer());
      expect(await sha256Hex(outputBytes)).toBe(job!.output_sha256);
      expect(
        validateGeneratedGlb(outputBytes, generationOutputRequirements),
      ).toMatchObject({
        triangleCount: 12,
        textureCount: 0,
      });

      const attempt = await env.DB.prepare(
        `SELECT COUNT(*) AS count, MIN(status) AS status,
                MIN(cost_units) AS cost_units,
                MIN(validation_code) AS validation_code
         FROM generation_provider_attempts
         WHERE workspace_id = ?1 AND job_id = ?2`,
      )
        .bind(workspaceId, created.id)
        .first<{
          count: number;
          status: string;
          cost_units: number;
          validation_code: string;
        }>();
      expect(attempt).toEqual({
        count: 1,
        status: "succeeded",
        cost_units: 1,
        validation_code: "GLB_VALID",
      });

      const repeated = await generationJobStartResponse(
        generationRequest(),
        env,
        context,
        assetId,
        "request-local-generation-repeat",
      );
      expect(repeated.status).toBe(200);
      expect(((await repeated.json()) as { id: string }).id).toBe(created.id);
      expect(await introspector.get()).toHaveLength(1);

      const beforeApproval = await env.DB.prepare(
        `SELECT available_units, reserved_units, settled_units, released_units
         FROM generation_credit_accounts WHERE workspace_id = ?1`,
      )
        .bind(workspaceId)
        .first();
      expect(beforeApproval).toEqual({
        available_units: 1,
        reserved_units: 1,
        settled_units: 0,
        released_units: 0,
      });

      const approval = await assetReviewMutationResponse(
        reviewRequest("approve"),
        env.DB,
        env.PRIVATE_ASSETS,
        context,
        assetId,
        "request-local-approval",
      );
      expect(approval.status).toBe(200);

      await expect(
        assetReviewMutationResponse(
          reviewRequest("approve"),
          env.DB,
          env.PRIVATE_ASSETS,
          context,
          assetId,
          "request-local-approval-repeat",
        ),
      ).rejects.toMatchObject({
        status: 409,
        code: "ASSET_VERSION_CONFLICT",
      });

      const afterApproval = await env.DB.prepare(
        `SELECT a.available_units, a.reserved_units, a.settled_units,
                a.released_units, e.status AS entitlement_status,
                p.review_version,
                (SELECT COUNT(*) FROM generation_credit_events AS ce
                 WHERE ce.workspace_id = ?1 AND ce.job_id = ?2
                   AND ce.event_type = 'settle') AS settle_events,
                (SELECT COUNT(*) FROM asset_review_events AS re
                 WHERE re.workspace_id = ?1 AND re.asset_id = p.id
                   AND re.decision = 'approve') AS review_events,
                (SELECT COUNT(*) FROM audit_events AS ae
                 WHERE ae.workspace_id = ?1 AND ae.target_id = p.id
                   AND ae.action = 'asset.review.approve') AS audit_events
         FROM generation_credit_accounts AS a
         INNER JOIN generation_job_entitlements AS e
           ON e.workspace_id = a.workspace_id
         INNER JOIN generation_jobs AS j
           ON j.workspace_id = e.workspace_id AND j.id = e.job_id
         INNER JOIN product_assets AS p
           ON p.workspace_id = j.workspace_id AND p.id = j.asset_id
         WHERE a.workspace_id = ?1 AND e.job_id = ?2`,
      )
        .bind(workspaceId, created.id)
        .first();
      expect(afterApproval).toEqual({
        available_units: 1,
        reserved_units: 0,
        settled_units: 1,
        released_units: 0,
        entitlement_status: "settled",
        review_version: 4,
        settle_events: 1,
        review_events: 1,
        audit_events: 1,
      });

      const creditEvents = await env.DB.prepare(
        `SELECT event_type FROM generation_credit_events
         WHERE workspace_id = ?1 AND job_id = ?2 ORDER BY event_type`,
      )
        .bind(workspaceId, created.id)
        .all<{ event_type: string }>();
      expect(creditEvents.results.map((event) => event.event_type)).toEqual([
        "reserve",
        "settle",
      ]);

      const foreignKeyViolations = await env.DB.prepare(
        "PRAGMA foreign_key_check",
      ).all();
      expect(foreignKeyViolations.results).toEqual([]);
    } finally {
      await introspector.dispose();
    }
  });

  it("does not resolve or reserve against another workspace asset", async () => {
    const protectedFixture: GenerationFixture = {
      workspaceId: "workspace-local-isolation-protected",
      userId: "user-local-isolation-protected",
      partId: "part-local-isolation-protected",
      assetId: "asset-local-isolation-protected",
      sourceSha256,
      slug: "local-isolation-protected",
      idempotencyKey: "local-isolation-protected-request-001",
    };
    const requesterFixture: GenerationFixture = {
      workspaceId: "workspace-local-isolation-requester",
      userId: "user-local-isolation-requester",
      partId: "part-local-isolation-requester",
      assetId: "asset-local-isolation-requester",
      sourceSha256,
      slug: "local-isolation-requester",
      idempotencyKey: "local-isolation-requester-request-001",
    };
    await seedGenerationFixture(protectedFixture);
    await seedGenerationFixture(requesterFixture);
    const introspector = await introspectWorkflow(env.ASSET_GENERATION);
    try {
      const foreignAssetRequest = generationRequest({
        ...requesterFixture,
        assetId: protectedFixture.assetId,
      });

      await expect(
        generationJobStartResponse(
          foreignAssetRequest,
          env,
          requestContextFor(requesterFixture),
          protectedFixture.assetId,
          "request-local-isolation",
        ),
      ).rejects.toMatchObject({ status: 404, code: "ASSET_NOT_FOUND" });

      const requesterState = await env.DB.prepare(
        `SELECT available_units, reserved_units,
                (SELECT COUNT(*) FROM generation_jobs
                 WHERE workspace_id = ?1) AS job_count
         FROM generation_credit_accounts
         WHERE workspace_id = ?1`,
      )
        .bind(requesterFixture.workspaceId)
        .first();
      expect(requesterState).toEqual({
        available_units: 2,
        reserved_units: 0,
        job_count: 0,
      });
      expect(await introspector.get()).toHaveLength(0);
    } finally {
      await introspector.dispose();
    }
  });

  it("rejects unavailable source storage before reservation and recovers with the same key", async () => {
    const sourceFixture: GenerationFixture = {
      workspaceId: "workspace-local-source-preflight",
      userId: "user-local-source-preflight",
      partId: "part-local-source-preflight",
      assetId: "asset-local-source-preflight",
      sourceSha256,
      slug: "local-source-preflight",
      idempotencyKey: "local-source-preflight-request-001",
    };
    await seedGenerationFixture(sourceFixture);
    const sourceKey = sourceObjectKey(sourceFixture);
    const creates: Array<WorkflowInstanceCreateOptions<AssetGenerationParams>> =
      [];
    const createdIds = new Set<string>();
    const workflow = {
      async create(
        options?: WorkflowInstanceCreateOptions<AssetGenerationParams>,
      ) {
        if (options) {
          creates.push(options);
          if (options.id) {
            createdIds.add(options.id);
          }
        }
        return { id: options?.id ?? "generated" } as WorkflowInstance;
      },
      async get(id: string) {
        return {
          id,
          async status() {
            return createdIds.has(id)
              ? { status: "running" as const }
              : { status: "unknown" as const };
          },
        } as WorkflowInstance;
      },
    } as Workflow<AssetGenerationParams>;
    const routeEnv = {
      ASSET_GENERATION: workflow,
      DB: env.DB,
      GENERATION_MODE: "simulation",
      GENERATION_MAX_COST_MINOR: "0",
      PRIVATE_ASSETS: env.PRIVATE_ASSETS,
    };
    const sourceContext = requestContextFor(sourceFixture);

    await env.PRIVATE_ASSETS.delete(sourceKey);
    await expect(
      generationJobStartResponse(
        generationRequest(sourceFixture),
        routeEnv,
        sourceContext,
        sourceFixture.assetId,
        "request-local-source-missing",
      ),
    ).rejects.toMatchObject({
      status: 409,
      code: "GENERATION_SOURCE_REQUIRED",
      message: expect.stringMatching(/來源.*source/iu),
    });

    await env.PRIVATE_ASSETS.put(sourceKey, new Uint8Array(127), {
      httpMetadata: { contentType: "image/png", cacheControl: "no-store" },
    });
    await expect(
      generationJobStartResponse(
        generationRequest(sourceFixture),
        routeEnv,
        sourceContext,
        sourceFixture.assetId,
        "request-local-source-size-drift",
      ),
    ).rejects.toMatchObject({ code: "GENERATION_SOURCE_REQUIRED" });

    await env.PRIVATE_ASSETS.put(sourceKey, sourceBytes, {
      httpMetadata: { contentType: "image/jpeg", cacheControl: "no-store" },
    });
    await expect(
      generationJobStartResponse(
        generationRequest(sourceFixture),
        routeEnv,
        sourceContext,
        sourceFixture.assetId,
        "request-local-source-type-drift",
      ),
    ).rejects.toMatchObject({ code: "GENERATION_SOURCE_REQUIRED" });

    const checksumDriftBytes = sourceBytes.slice();
    checksumDriftBytes[checksumDriftBytes.byteLength - 1] = 0x01;
    await env.PRIVATE_ASSETS.put(sourceKey, checksumDriftBytes, {
      httpMetadata: { contentType: "image/png", cacheControl: "no-store" },
    });
    await expect(
      generationJobStartResponse(
        generationRequest(sourceFixture),
        routeEnv,
        sourceContext,
        sourceFixture.assetId,
        "request-local-source-checksum-drift",
      ),
    ).rejects.toMatchObject({ code: "GENERATION_SOURCE_REQUIRED" });

    expect(
      await env.DB.prepare(
        `SELECT available_units, reserved_units,
                (SELECT COUNT(*) FROM generation_jobs
                 WHERE workspace_id = ?1) AS job_count,
                (SELECT COUNT(*) FROM audit_events
                 WHERE workspace_id = ?1 AND action = 'generation.request')
                  AS audit_count
         FROM generation_credit_accounts WHERE workspace_id = ?1`,
      )
        .bind(sourceFixture.workspaceId)
        .first(),
    ).toEqual({
      available_units: 2,
      reserved_units: 0,
      job_count: 0,
      audit_count: 0,
    });
    expect(creates).toHaveLength(0);

    await env.PRIVATE_ASSETS.put(sourceKey, sourceBytes, {
      httpMetadata: { contentType: "image/png", cacheControl: "no-store" },
    });
    const recovered = await generationJobStartResponse(
      generationRequest(sourceFixture),
      routeEnv,
      sourceContext,
      sourceFixture.assetId,
      "request-local-source-recovered",
    );
    expect(recovered.status).toBe(202);
    expect(creates).toHaveLength(1);
    const replay = await generationJobStartResponse(
      generationRequest(sourceFixture),
      routeEnv,
      sourceContext,
      sourceFixture.assetId,
      "request-local-source-replay",
    );
    expect(replay.status).toBe(200);
    expect(creates).toHaveLength(1);
    expect(
      await env.DB.prepare(
        `SELECT available_units, reserved_units,
                (SELECT COUNT(*) FROM generation_jobs
                 WHERE workspace_id = ?1) AS job_count,
                (SELECT COUNT(*) FROM audit_events
                 WHERE workspace_id = ?1 AND action = 'generation.request')
                  AS audit_count
         FROM generation_credit_accounts WHERE workspace_id = ?1`,
      )
        .bind(sourceFixture.workspaceId)
        .first(),
    ).toEqual({
      available_units: 1,
      reserved_units: 1,
      job_count: 1,
      audit_count: 1,
    });
  });

  it("rolls back reservation when the catalogue part is archived before the batch", async () => {
    const raceFixture: GenerationFixture = {
      workspaceId: "workspace-local-catalogue-reservation-race",
      userId: "user-local-catalogue-reservation-race",
      partId: "part-local-catalogue-reservation-race",
      assetId: "asset-local-catalogue-reservation-race",
      sourceSha256,
      slug: "local-catalogue-reservation-race",
      idempotencyKey: "local-catalogue-reservation-race-request-001",
    };
    await seedGenerationFixture(raceFixture);
    const creates: Array<WorkflowInstanceCreateOptions<AssetGenerationParams>> =
      [];
    const createdIds = new Set<string>();
    const workflow = {
      async create(
        options?: WorkflowInstanceCreateOptions<AssetGenerationParams>,
      ) {
        if (options) {
          creates.push(options);
          if (options.id) {
            createdIds.add(options.id);
          }
        }
        return { id: options?.id ?? "generated" } as WorkflowInstance;
      },
      async get(id: string) {
        return {
          id,
          async status() {
            return createdIds.has(id)
              ? { status: "running" as const }
              : { status: "unknown" as const };
          },
        } as WorkflowInstance;
      },
    } as Workflow<AssetGenerationParams>;
    const racingDb = databaseWithBeforeBatch(async () => {
      await env.DB.prepare(
        `UPDATE catalog_parts SET status = 'archived'
         WHERE workspace_id = ?1 AND id = ?2`,
      )
        .bind(raceFixture.workspaceId, raceFixture.partId)
        .run();
    });
    const routeEnv = {
      ASSET_GENERATION: workflow,
      DB: racingDb,
      GENERATION_MODE: "simulation",
      GENERATION_MAX_COST_MINOR: "0",
      PRIVATE_ASSETS: env.PRIVATE_ASSETS,
    };

    await expect(
      generationJobStartResponse(
        generationRequest(raceFixture),
        routeEnv,
        requestContextFor(raceFixture),
        raceFixture.assetId,
        "request-local-catalogue-reservation-race",
      ),
    ).rejects.toMatchObject({
      status: 409,
      code: "ASSET_VERSION_CONFLICT",
      message: expect.stringMatching(/更新.*reload/iu),
    });
    expect(
      await env.DB.prepare(
        `SELECT available_units, reserved_units,
                (SELECT COUNT(*) FROM generation_jobs
                 WHERE workspace_id = ?1) AS job_count,
                (SELECT COUNT(*) FROM generation_credit_events
                 WHERE workspace_id = ?1) AS credit_events,
                (SELECT COUNT(*) FROM audit_events
                 WHERE workspace_id = ?1 AND action = 'generation.request')
                  AS audit_count
         FROM generation_credit_accounts WHERE workspace_id = ?1`,
      )
        .bind(raceFixture.workspaceId)
        .first(),
    ).toEqual({
      available_units: 2,
      reserved_units: 0,
      job_count: 0,
      credit_events: 0,
      audit_count: 0,
    });
    expect(creates).toHaveLength(0);

    await env.DB.prepare(
      `UPDATE catalog_parts SET status = 'active'
       WHERE workspace_id = ?1 AND id = ?2`,
    )
      .bind(raceFixture.workspaceId, raceFixture.partId)
      .run();
    const recovered = await generationJobStartResponse(
      generationRequest(raceFixture),
      { ...routeEnv, DB: env.DB },
      requestContextFor(raceFixture),
      raceFixture.assetId,
      "request-local-catalogue-reservation-recovered",
    );
    expect(recovered.status).toBe(202);
    expect(creates).toHaveLength(1);
    const replay = await generationJobStartResponse(
      generationRequest(raceFixture),
      { ...routeEnv, DB: env.DB },
      requestContextFor(raceFixture),
      raceFixture.assetId,
      "request-local-catalogue-reservation-replay",
    );
    expect(replay.status).toBe(200);
    expect(creates).toHaveLength(1);
  });

  it("releases once when the catalogue part is archived before Workflow claim", async () => {
    const raceFixture: GenerationFixture = {
      workspaceId: "workspace-local-catalogue-claim-race",
      userId: "user-local-catalogue-claim-race",
      partId: "part-local-catalogue-claim-race",
      assetId: "asset-local-catalogue-claim-race",
      sourceSha256,
      slug: "local-catalogue-claim-race",
      idempotencyKey: "local-catalogue-claim-race-request-001",
    };
    await seedGenerationFixture(raceFixture);
    const introspector = await introspectWorkflow(env.ASSET_GENERATION);
    try {
      await introspector.modifyAll(async (modifier) => {
        await modifier.disableRetryDelays();
      });
      const workflow = {
        async create(
          options?: WorkflowInstanceCreateOptions<AssetGenerationParams>,
        ) {
          await env.DB.prepare(
            `UPDATE catalog_parts SET status = 'archived'
             WHERE workspace_id = ?1 AND id = ?2`,
          )
            .bind(raceFixture.workspaceId, raceFixture.partId)
            .run();
          return env.ASSET_GENERATION.create(options);
        },
        get(id: string) {
          return env.ASSET_GENERATION.get(id);
        },
      } as Workflow<AssetGenerationParams>;
      const response = await generationJobStartResponse(
        generationRequest(raceFixture),
        {
          ASSET_GENERATION: workflow,
          DB: env.DB,
          GENERATION_MODE: "simulation",
          GENERATION_MAX_COST_MINOR: "0",
          PRIVATE_ASSETS: env.PRIVATE_ASSETS,
        },
        requestContextFor(raceFixture),
        raceFixture.assetId,
        "request-local-catalogue-claim-race",
      );
      expect(response.status).toBe(202);
      const created = (await response.json()) as { id: string };
      const instances = await introspector.get();
      expect(instances).toHaveLength(1);
      await expect(
        instances[0]!.waitForStatus("errored"),
      ).resolves.not.toThrow();

      expect(
        await env.DB.prepare(
          `SELECT j.status, j.failure_code, e.status AS entitlement_status,
                  a.available_units, a.reserved_units, a.released_units,
                  p.review_version, p.model_object_key,
                  (SELECT COUNT(*) FROM generation_provider_attempts AS pa
                   WHERE pa.workspace_id = j.workspace_id AND pa.job_id = j.id)
                    AS provider_attempts,
                  (SELECT COUNT(*) FROM generation_credit_events AS ce
                   WHERE ce.workspace_id = j.workspace_id AND ce.job_id = j.id
                     AND ce.event_type = 'release') AS release_events
           FROM generation_jobs AS j
           INNER JOIN generation_job_entitlements AS e
             ON e.workspace_id = j.workspace_id AND e.job_id = j.id
           INNER JOIN generation_credit_accounts AS a
             ON a.workspace_id = j.workspace_id
           INNER JOIN product_assets AS p
             ON p.workspace_id = j.workspace_id AND p.id = j.asset_id
           WHERE j.workspace_id = ?1 AND j.id = ?2`,
        )
          .bind(raceFixture.workspaceId, created.id)
          .first(),
      ).toEqual({
        status: "failed",
        failure_code: "GENERATION_INPUT_STALE",
        entitlement_status: "released",
        available_units: 2,
        reserved_units: 0,
        released_units: 1,
        review_version: 2,
        model_object_key: null,
        provider_attempts: 0,
        release_events: 1,
      });
      const modelObjects = await env.PRIVATE_ASSETS.list({
        prefix: `workspaces/${raceFixture.workspaceId}/assets/${raceFixture.assetId}/model/`,
      });
      expect(modelObjects.objects).toHaveLength(0);

      const replay = await generationJobStartResponse(
        generationRequest(raceFixture),
        env,
        requestContextFor(raceFixture),
        raceFixture.assetId,
        "request-local-catalogue-claim-race-replay",
      );
      expect(replay.status).toBe(200);
      await expect(replay.json()).resolves.toMatchObject({
        id: created.id,
        status: "failed",
        failureCode: "GENERATION_INPUT_STALE",
        entitlementStatus: "released",
      });
      expect(await introspector.get()).toHaveLength(1);
    } finally {
      await introspector.dispose();
    }
  });

  it("cleans the draft and releases once when the catalogue part is archived before staging", async () => {
    const raceFixture: GenerationFixture = {
      workspaceId: "workspace-local-catalogue-stage-race",
      userId: "user-local-catalogue-stage-race",
      partId: "part-local-catalogue-stage-race",
      assetId: "asset-local-catalogue-stage-race",
      sourceSha256,
      slug: "local-catalogue-stage-race",
      idempotencyKey: "local-catalogue-stage-race-request-001",
    };
    await seedGenerationFixture(raceFixture);
    const jobId = "generation-local-catalogue-stage-race";
    await env.DB.batch([
      env.DB.prepare(
        `UPDATE generation_credit_accounts
         SET available_units = 1, reserved_units = 1
         WHERE workspace_id = ?1`,
      ).bind(raceFixture.workspaceId),
      env.DB.prepare(
        `INSERT INTO generation_jobs (
           id, workspace_id, asset_id, requested_by, status, execution_mode,
           idempotency_key, workflow_instance_id, requested_review_version,
           input_sha256, max_cost_minor, max_provider_cost_units
         ) VALUES (?1, ?2, ?3, ?4, 'validating', 'simulation', ?5, ?1, 2, ?6, 0, 1)`,
      ).bind(
        jobId,
        raceFixture.workspaceId,
        raceFixture.assetId,
        raceFixture.userId,
        raceFixture.idempotencyKey,
        raceFixture.sourceSha256,
      ),
      env.DB.prepare(
        `INSERT INTO generation_job_entitlements (
           workspace_id, job_id, units, status
         ) VALUES (?1, ?2, 1, 'reserved')`,
      ).bind(raceFixture.workspaceId, jobId),
      env.DB.prepare(
        `INSERT INTO generation_credit_events (
           id, workspace_id, job_id, event_type, units, reason_code
         ) VALUES (?1, ?2, ?3, 'reserve', 1, 'generation_requested')`,
      ).bind(crypto.randomUUID(), raceFixture.workspaceId, jobId),
    ]);
    const bytes = createSyntheticDraftGlb();
    const objectKey = `workspaces/${raceFixture.workspaceId}/assets/${raceFixture.assetId}/model/catalogue-stage-race`;
    await env.PRIVATE_ASSETS.put(objectKey, bytes, {
      httpMetadata: {
        contentType: "model/gltf-binary",
        cacheControl: "no-store",
      },
    });
    const params: AssetGenerationParams = {
      workspaceId: raceFixture.workspaceId,
      assetId: raceFixture.assetId,
      jobId,
      requestedReviewVersion: 2,
    };
    const racingDb = databaseWithBeforeBatch(async () => {
      await env.DB.prepare(
        `UPDATE catalog_parts SET status = 'archived'
         WHERE workspace_id = ?1 AND id = ?2`,
      )
        .bind(raceFixture.workspaceId, raceFixture.partId)
        .run();
    });

    await expect(
      stageGeneratedDraft(
        { DB: racingDb, PRIVATE_ASSETS: env.PRIVATE_ASSETS },
        params,
        {
          attemptKey: "primary",
          contentType: "model/gltf-binary",
          durationMs: 0,
          objectKey,
          providerCostUnits: 1,
          sha256: await sha256Hex(bytes),
          sizeBytes: bytes.byteLength,
          validation: validateGeneratedGlb(bytes, generationOutputRequirements),
        },
      ),
    ).rejects.toMatchObject({ code: "GENERATION_INPUT_STALE" });
    expect(await env.PRIVATE_ASSETS.head(objectKey)).toBeNull();
    expect(
      await env.DB.prepare(
        `SELECT j.status, j.failure_code, j.output_object_key,
                e.status AS entitlement_status,
                a.available_units, a.reserved_units, a.released_units,
                p.review_version, p.model_object_key,
                p.source_rights_confirmed,
                (SELECT COUNT(*) FROM generation_credit_events AS ce
                 WHERE ce.workspace_id = j.workspace_id AND ce.job_id = j.id
                   AND ce.event_type = 'release') AS release_events
         FROM generation_jobs AS j
         INNER JOIN generation_job_entitlements AS e
           ON e.workspace_id = j.workspace_id AND e.job_id = j.id
         INNER JOIN generation_credit_accounts AS a
           ON a.workspace_id = j.workspace_id
         INNER JOIN product_assets AS p
           ON p.workspace_id = j.workspace_id AND p.id = j.asset_id
         WHERE j.workspace_id = ?1 AND j.id = ?2`,
      )
        .bind(raceFixture.workspaceId, jobId)
        .first(),
    ).toEqual({
      status: "failed",
      failure_code: "GENERATION_INPUT_STALE",
      output_object_key: null,
      entitlement_status: "released",
      available_units: 2,
      reserved_units: 0,
      released_units: 1,
      review_version: 2,
      model_object_key: null,
      source_rights_confirmed: 1,
      release_events: 1,
    });
  });

  it("releases once when source bytes drift after route preflight", async () => {
    const raceFixture: GenerationFixture = {
      workspaceId: "workspace-local-source-race",
      userId: "user-local-source-race",
      partId: "part-local-source-race",
      assetId: "asset-local-source-race",
      sourceSha256,
      slug: "local-source-race",
      idempotencyKey: "local-source-race-request-001",
    };
    await seedGenerationFixture(raceFixture);
    const introspector = await introspectWorkflow(env.ASSET_GENERATION);
    try {
      await introspector.modifyAll(async (modifier) => {
        await modifier.disableRetryDelays();
      });
      const racingBucket = {
        async head(key: string) {
          return env.PRIVATE_ASSETS.head(key);
        },
        async get(key: string) {
          const object = await env.PRIVATE_ASSETS.get(key);
          const checksumDriftBytes = sourceBytes.slice();
          checksumDriftBytes[checksumDriftBytes.byteLength - 1] = 0x01;
          await env.PRIVATE_ASSETS.put(key, checksumDriftBytes, {
            httpMetadata: {
              contentType: "image/png",
              cacheControl: "no-store",
            },
          });
          return object;
        },
      } as unknown as R2Bucket;
      const response = await generationJobStartResponse(
        generationRequest(raceFixture),
        {
          ASSET_GENERATION: env.ASSET_GENERATION,
          DB: env.DB,
          GENERATION_MODE: "simulation",
          GENERATION_MAX_COST_MINOR: "0",
          PRIVATE_ASSETS: racingBucket,
        },
        requestContextFor(raceFixture),
        raceFixture.assetId,
        "request-local-source-race",
      );
      expect(response.status).toBe(202);
      const created = (await response.json()) as { id: string };
      const instances = await introspector.get();
      expect(instances).toHaveLength(1);
      await expect(
        instances[0]!.waitForStatus("errored"),
      ).resolves.not.toThrow();

      expect(
        await env.DB.prepare(
          `SELECT j.status, j.failure_code, e.status AS entitlement_status,
                  a.available_units, a.reserved_units, a.released_units,
                  (SELECT COUNT(*) FROM generation_provider_attempts AS pa
                   WHERE pa.workspace_id = j.workspace_id AND pa.job_id = j.id)
                    AS provider_attempts,
                  (SELECT COUNT(*) FROM generation_credit_events AS ce
                   WHERE ce.workspace_id = j.workspace_id AND ce.job_id = j.id
                     AND ce.event_type = 'release') AS release_events
           FROM generation_jobs AS j
           INNER JOIN generation_job_entitlements AS e
             ON e.workspace_id = j.workspace_id AND e.job_id = j.id
           INNER JOIN generation_credit_accounts AS a
             ON a.workspace_id = j.workspace_id
           WHERE j.workspace_id = ?1 AND j.id = ?2`,
        )
          .bind(raceFixture.workspaceId, created.id)
          .first(),
      ).toEqual({
        status: "failed",
        failure_code: "GENERATION_INPUT_MISSING",
        entitlement_status: "released",
        available_units: 2,
        reserved_units: 0,
        released_units: 1,
        provider_attempts: 0,
        release_events: 1,
      });

      const replay = await generationJobStartResponse(
        generationRequest(raceFixture),
        env,
        requestContextFor(raceFixture),
        raceFixture.assetId,
        "request-local-source-race-replay",
      );
      expect(replay.status).toBe(200);
      await expect(replay.json()).resolves.toMatchObject({
        id: created.id,
        status: "failed",
        failureCode: "GENERATION_INPUT_MISSING",
        entitlementStatus: "released",
      });
      expect(await introspector.get()).toHaveLength(1);
    } finally {
      await introspector.dispose();
    }
  });

  it("releases once and replays safely when Workflow creation fails", async () => {
    const startFailureFixture: GenerationFixture = {
      workspaceId: "workspace-local-start-failure",
      userId: "user-local-start-failure",
      partId: "part-local-start-failure",
      assetId: "asset-local-start-failure",
      sourceSha256,
      slug: "local-start-failure",
      idempotencyKey: "local-start-failure-request-001",
    };
    await seedGenerationFixture(startFailureFixture);
    const creates: Array<WorkflowInstanceCreateOptions<AssetGenerationParams>> =
      [];
    const failingWorkflow = {
      async create(
        options?: WorkflowInstanceCreateOptions<AssetGenerationParams>,
      ) {
        if (options) {
          creates.push(options);
        }
        throw new Error("Synthetic Workflow start failure.");
      },
      async createBatch(
        options: WorkflowInstanceCreateOptions<AssetGenerationParams>[],
      ) {
        creates.push(...options);
        throw new Error("Synthetic Workflow batch start failure.");
      },
      async get(id: string) {
        return {
          id,
          async status() {
            return { status: "unknown" as const };
          },
        } as WorkflowInstance;
      },
    } as Workflow<AssetGenerationParams>;
    const routeEnv = {
      ASSET_GENERATION: failingWorkflow,
      DB: env.DB,
      GENERATION_MODE: "simulation",
      GENERATION_MAX_COST_MINOR: "0",
      PRIVATE_ASSETS: env.PRIVATE_ASSETS,
    };
    const startFailureContext = requestContextFor(startFailureFixture);

    await expect(
      generationJobStartResponse(
        generationRequest(startFailureFixture),
        routeEnv,
        startFailureContext,
        startFailureFixture.assetId,
        "request-local-start-failure",
      ),
    ).rejects.toMatchObject({
      status: 503,
      code: "GENERATION_START_FAILED",
    });
    expect(creates).toHaveLength(1);

    const failed = await env.DB.prepare(
      `SELECT j.id, j.status, j.failure_code,
              e.status AS entitlement_status, e.release_reason_code,
              a.available_units, a.reserved_units, a.settled_units,
              a.released_units,
              (SELECT COUNT(*) FROM generation_credit_events AS ce
               WHERE ce.workspace_id = j.workspace_id AND ce.job_id = j.id
                 AND ce.event_type = 'release') AS release_events,
              (SELECT COUNT(*) FROM generation_job_events AS je
               WHERE je.workspace_id = j.workspace_id AND je.job_id = j.id
                 AND je.event_type = 'start_failed') AS start_failed_events,
              (SELECT COUNT(*) FROM generation_provider_attempts AS pa
               WHERE pa.workspace_id = j.workspace_id AND pa.job_id = j.id)
                AS provider_attempts
       FROM generation_jobs AS j
       INNER JOIN generation_job_entitlements AS e
         ON e.workspace_id = j.workspace_id AND e.job_id = j.id
       INNER JOIN generation_credit_accounts AS a
         ON a.workspace_id = j.workspace_id
       WHERE j.workspace_id = ?1 AND j.idempotency_key = ?2`,
    )
      .bind(startFailureFixture.workspaceId, startFailureFixture.idempotencyKey)
      .first<Record<string, unknown>>();
    expect(failed).toMatchObject({
      status: "failed",
      failure_code: "GENERATION_START_FAILED",
      entitlement_status: "released",
      release_reason_code: "start_failed",
      available_units: 2,
      reserved_units: 0,
      settled_units: 0,
      released_units: 1,
      release_events: 1,
      start_failed_events: 1,
      provider_attempts: 0,
    });

    const repeated = await generationJobStartResponse(
      generationRequest(startFailureFixture),
      routeEnv,
      startFailureContext,
      startFailureFixture.assetId,
      "request-local-start-failure-repeat",
    );
    expect(repeated.status).toBe(200);
    await expect(repeated.json()).resolves.toMatchObject({
      id: failed?.id,
      status: "failed",
      failureCode: "GENERATION_START_FAILED",
      entitlementStatus: "released",
    });
    expect(creates).toHaveLength(1);

    const afterReplay = await env.DB.prepare(
      `SELECT a.available_units, a.reserved_units, a.released_units,
              (SELECT COUNT(*) FROM generation_credit_events AS ce
               WHERE ce.workspace_id = ?1 AND ce.job_id = ?2
                 AND ce.event_type = 'release') AS release_events
       FROM generation_credit_accounts AS a
       WHERE a.workspace_id = ?1`,
    )
      .bind(startFailureFixture.workspaceId, failed?.id)
      .first();
    expect(afterReplay).toEqual({
      available_units: 2,
      reserved_units: 0,
      released_units: 1,
      release_events: 1,
    });
  });

  it("remains fail-closed across repeated requests without available credit", async () => {
    const noCreditFixture: GenerationFixture = {
      workspaceId: "workspace-local-no-credit",
      userId: "user-local-no-credit",
      partId: "part-local-no-credit",
      assetId: "asset-local-no-credit",
      sourceSha256,
      slug: "local-no-credit",
      idempotencyKey: "local-no-credit-request-001",
    };
    await seedGenerationFixture(noCreditFixture);
    await env.DB.prepare(
      `UPDATE generation_credit_accounts
       SET available_units = 0 WHERE workspace_id = ?1`,
    )
      .bind(noCreditFixture.workspaceId)
      .run();
    const noCreditContext = requestContextFor(noCreditFixture);
    const introspector = await introspectWorkflow(env.ASSET_GENERATION);
    try {
      for (const requestId of [
        "request-local-no-credit",
        "request-local-no-credit-repeat",
      ]) {
        await expect(
          generationJobStartResponse(
            generationRequest(noCreditFixture),
            env,
            noCreditContext,
            noCreditFixture.assetId,
            requestId,
          ),
        ).rejects.toMatchObject({
          status: 409,
          code: "GENERATION_CREDITS_REQUIRED",
        });
      }

      const state = await env.DB.prepare(
        `SELECT a.available_units, a.reserved_units, a.settled_units,
                a.released_units, p.review_version,
                p.source_rights_confirmed,
                (SELECT COUNT(*) FROM generation_jobs AS j
                 WHERE j.workspace_id = a.workspace_id) AS job_count,
                (SELECT COUNT(*) FROM generation_credit_events AS ce
                 WHERE ce.workspace_id = a.workspace_id) AS credit_events,
                (SELECT COUNT(*) FROM generation_provider_attempts AS pa
                 WHERE pa.workspace_id = a.workspace_id) AS provider_attempts,
                (SELECT COUNT(*) FROM audit_events AS ae
                 WHERE ae.workspace_id = a.workspace_id
                   AND ae.action = 'generation.request') AS request_audits
         FROM generation_credit_accounts AS a
         INNER JOIN product_assets AS p ON p.workspace_id = a.workspace_id
         WHERE a.workspace_id = ?1 AND p.id = ?2`,
      )
        .bind(noCreditFixture.workspaceId, noCreditFixture.assetId)
        .first();
      expect(state).toEqual({
        available_units: 0,
        reserved_units: 0,
        settled_units: 0,
        released_units: 0,
        review_version: 2,
        source_rights_confirmed: 1,
        job_count: 0,
        credit_events: 0,
        provider_attempts: 0,
        request_audits: 0,
      });
      expect(await introspector.get()).toHaveLength(0);
    } finally {
      await introspector.dispose();
    }
  });

  it("releases a reserved credit exactly once after a terminal failure", async () => {
    const failedWorkspaceId = "workspace-local-failure";
    const failedUserId = "user-local-failure";
    const failedPartId = "part-local-failure";
    const failedAssetId = "asset-local-failure";
    const failedJobId = "generation-local-failure";
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO workspaces (id, slug, name) VALUES (?1, ?2, ?3)`,
      ).bind(failedWorkspaceId, "local-failure", "Local Failure"),
      env.DB.prepare(
        `INSERT INTO users (id, email, last_workspace_id)
         VALUES (?1, ?2, ?3)`,
      ).bind(failedUserId, "local-failure@example.invalid", failedWorkspaceId),
      env.DB.prepare(
        `INSERT INTO catalog_parts (
           id, workspace_id, sku, category, manufacturer, model,
           specifications_json, specification_status
         ) VALUES (?1, ?2, ?3, 'cooling', 'Fixture', 'Failure Fixture',
                   '{}', 'verified')`,
      ).bind(failedPartId, failedWorkspaceId, "LOCAL-FAILURE-001"),
      env.DB.prepare(
        `INSERT INTO product_assets (
           id, workspace_id, catalog_part_id, status, quality, source_kind,
           source_rights_confirmed, review_version, source_object_key,
           source_content_type, source_size_bytes, source_sha256
         ) VALUES (?1, ?2, ?3, 'draft', 'draft', 'uploaded', 1, 1, ?4,
                   'image/png', 128, ?5)`,
      ).bind(
        failedAssetId,
        failedWorkspaceId,
        failedPartId,
        `workspaces/${failedWorkspaceId}/source/fixture`,
        "b".repeat(64),
      ),
      env.DB.prepare(
        `INSERT INTO generation_jobs (
           id, workspace_id, asset_id, requested_by, status, execution_mode,
           idempotency_key, workflow_instance_id, requested_review_version,
           input_sha256, max_cost_minor, max_provider_cost_units
         ) VALUES (?1, ?2, ?3, ?4, 'running', 'simulation', ?5, ?1, 1, ?6, 0, 1)`,
      ).bind(
        failedJobId,
        failedWorkspaceId,
        failedAssetId,
        failedUserId,
        "local-failure-request-001",
        "b".repeat(64),
      ),
      env.DB.prepare(
        `INSERT INTO generation_credit_accounts (
           workspace_id, available_units, reserved_units
         ) VALUES (?1, 1, 1)`,
      ).bind(failedWorkspaceId),
      env.DB.prepare(
        `INSERT INTO generation_job_entitlements (
           workspace_id, job_id, units, status
         ) VALUES (?1, ?2, 1, 'reserved')`,
      ).bind(failedWorkspaceId, failedJobId),
    ]);

    const params = {
      workspaceId: failedWorkspaceId,
      assetId: failedAssetId,
      jobId: failedJobId,
      requestedReviewVersion: 1,
    };
    await markGenerationFailed(env.DB, params, "GENERATION_OUTPUT_INVALID");
    await markGenerationFailed(env.DB, params, "GENERATION_OUTPUT_INVALID");

    const result = await env.DB.prepare(
      `SELECT a.available_units, a.reserved_units, a.settled_units,
              a.released_units, e.status AS entitlement_status,
              (SELECT COUNT(*) FROM generation_credit_events AS ce
               WHERE ce.workspace_id = ?1 AND ce.job_id = ?2
                 AND ce.event_type = 'release') AS release_events
       FROM generation_credit_accounts AS a
       INNER JOIN generation_job_entitlements AS e
         ON e.workspace_id = a.workspace_id
       WHERE a.workspace_id = ?1 AND e.job_id = ?2`,
    )
      .bind(failedWorkspaceId, failedJobId)
      .first();
    expect(result).toEqual({
      available_units: 2,
      reserved_units: 0,
      settled_units: 0,
      released_units: 1,
      entitlement_status: "released",
      release_events: 1,
    });
  });

  it("releases and records a repeated human rejection exactly once", async () => {
    const rejectionFixture: GenerationFixture = {
      workspaceId: "workspace-local-rejection",
      userId: "user-local-rejection",
      partId: "part-local-rejection",
      assetId: "asset-local-rejection",
      sourceSha256,
      slug: "local-rejection",
      idempotencyKey: "local-rejection-request-001",
    };
    const rejectionContext = requestContextFor(rejectionFixture);
    await seedGenerationFixture(rejectionFixture);
    const introspector = await introspectWorkflow(env.ASSET_GENERATION);
    try {
      await introspector.modifyAll(async (modifier) => {
        await modifier.disableRetryDelays();
      });

      const response = await generationJobStartResponse(
        generationRequest(rejectionFixture),
        env,
        rejectionContext,
        rejectionFixture.assetId,
        "request-local-rejection-generation",
      );
      expect(response.status).toBe(202);
      const created = (await response.json()) as { id: string };
      const instances = await introspector.get();
      expect(instances).toHaveLength(1);
      await expect(
        instances[0]!.waitForStatus("complete"),
      ).resolves.not.toThrow();

      const rejection = await assetReviewMutationResponse(
        reviewRequest("reject", rejectionFixture),
        env.DB,
        env.PRIVATE_ASSETS,
        rejectionContext,
        rejectionFixture.assetId,
        "request-local-rejection",
      );
      expect(rejection.status).toBe(200);

      await expect(
        assetReviewMutationResponse(
          reviewRequest("reject", rejectionFixture),
          env.DB,
          env.PRIVATE_ASSETS,
          rejectionContext,
          rejectionFixture.assetId,
          "request-local-rejection-repeat",
        ),
      ).rejects.toMatchObject({
        status: 409,
        code: "ASSET_VERSION_CONFLICT",
      });

      const result = await env.DB.prepare(
        `SELECT a.available_units, a.reserved_units, a.settled_units,
                a.released_units, e.status AS entitlement_status,
                j.status AS job_status, p.review_version,
                (SELECT COUNT(*) FROM generation_credit_events AS ce
                 WHERE ce.workspace_id = ?1 AND ce.job_id = ?2
                   AND ce.event_type = 'release') AS release_events,
                (SELECT COUNT(*) FROM asset_review_events AS re
                 WHERE re.workspace_id = ?1 AND re.asset_id = p.id
                   AND re.decision = 'reject') AS review_events,
                (SELECT COUNT(*) FROM audit_events AS ae
                 WHERE ae.workspace_id = ?1 AND ae.target_id = p.id
                   AND ae.action = 'asset.review.reject') AS audit_events
         FROM generation_credit_accounts AS a
         INNER JOIN generation_job_entitlements AS e
           ON e.workspace_id = a.workspace_id
         INNER JOIN generation_jobs AS j
           ON j.workspace_id = e.workspace_id AND j.id = e.job_id
         INNER JOIN product_assets AS p
           ON p.workspace_id = j.workspace_id AND p.id = j.asset_id
         WHERE a.workspace_id = ?1 AND e.job_id = ?2`,
      )
        .bind(rejectionFixture.workspaceId, created.id)
        .first();
      expect(result).toEqual({
        available_units: 2,
        reserved_units: 0,
        settled_units: 0,
        released_units: 1,
        entitlement_status: "released",
        job_status: "failed",
        review_version: 4,
        release_events: 1,
        review_events: 1,
        audit_events: 1,
      });
    } finally {
      await introspector.dispose();
    }
  });
});
