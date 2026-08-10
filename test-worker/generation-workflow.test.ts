import { introspectWorkflow } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import { assetReviewChecks } from "../src/shared/domain/assets";
import { validateGeneratedGlb } from "../src/shared/domain/glb-validation";
import type { RequestContext } from "../src/worker/auth/workspace";
import { generationOutputRequirements } from "../src/worker/generation/provider";
import { assetReviewMutationResponse } from "../src/worker/routes/assets";
import { generationJobStartResponse } from "../src/worker/routes/generation-jobs";
import { markGenerationFailed } from "../src/worker/workflows/asset-generation";

const workspaceId = "workspace-local-generation";
const userId = "user-local-generation";
const partId = "part-local-generation";
const assetId = "asset-local-generation";
const sourceSha256 = "a".repeat(64);

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
      `workspaces/${fixture.workspaceId}/assets/${fixture.assetId}/source/fixture`,
      fixture.sourceSha256,
      fixture.userId,
    ),
    env.DB.prepare(
      `INSERT INTO generation_credit_accounts (workspace_id, available_units)
       VALUES (?1, 2)`,
    ).bind(fixture.workspaceId),
  ]);
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
      const outputBytes = new Uint8Array(await privateObject!.arrayBuffer());
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
        context,
        assetId,
        "request-local-approval",
      );
      expect(approval.status).toBe(200);

      await expect(
        assetReviewMutationResponse(
          reviewRequest("approve"),
          env.DB,
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
      sourceSha256: "d".repeat(64),
      slug: "local-isolation-protected",
      idempotencyKey: "local-isolation-protected-request-001",
    };
    const requesterFixture: GenerationFixture = {
      workspaceId: "workspace-local-isolation-requester",
      userId: "user-local-isolation-requester",
      partId: "part-local-isolation-requester",
      assetId: "asset-local-isolation-requester",
      sourceSha256: "e".repeat(64),
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
      sourceSha256: "c".repeat(64),
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
        rejectionContext,
        rejectionFixture.assetId,
        "request-local-rejection",
      );
      expect(rejection.status).toBe(200);

      await expect(
        assetReviewMutationResponse(
          reviewRequest("reject", rejectionFixture),
          env.DB,
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
