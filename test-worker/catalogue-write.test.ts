import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import type { ComponentCategory } from "../src/shared/domain/schemas";
import type { WorkspaceRole } from "../src/shared/domain/session";
import type { RequestContext } from "../src/worker/auth/workspace";
import { assetReviewMutationResponse } from "../src/worker/routes/assets";
import { catalogueMutationResponse } from "../src/worker/routes/catalogue-write";

type WorkspaceFixture = {
  role: WorkspaceRole;
  slug: string;
  userId: string;
  workspaceId: string;
};

const protectedFixture: WorkspaceFixture = {
  role: "owner",
  slug: "catalogue-write-protected",
  userId: "user-catalogue-write-protected",
  workspaceId: "workspace-catalogue-write-protected",
};

const foreignFixture: WorkspaceFixture = {
  role: "owner",
  slug: "catalogue-write-foreign",
  userId: "user-catalogue-write-foreign",
  workspaceId: "workspace-catalogue-write-foreign",
};

const partId = "part-catalogue-write-locked";
const buildId = "build-catalogue-write-reference";

function context(fixture: WorkspaceFixture): RequestContext {
  return {
    user: {
      id: fixture.userId,
      email: `${fixture.userId}@example.invalid`,
      displayName: "Catalogue Write Fixture",
    },
    currentWorkspace: {
      id: fixture.workspaceId,
      slug: fixture.slug,
      name: "Catalogue Write Fixture",
      locale: "zh-Hant-HK",
      currency: "HKD",
      role: fixture.role,
    },
    workspaces: [],
  };
}

function updateRequest(
  expectedVersion: number,
  category: ComponentCategory,
  model: string,
): Request {
  return new Request("https://local.invalid/api/catalogue/part", {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      "x-rigstage-catalogue-part-id": partId,
    },
    body: JSON.stringify({
      action: "update",
      expectedVersion,
      sku: "LOCKED-CATEGORY-001",
      category,
      manufacturer: "Fixture",
      model,
      priceMinor: 89_900,
      stockStatus: "in_stock",
      stockCount: 4,
      specificationStatus: "verified",
      specifications: {},
    }),
  });
}

function archiveRequest(targetPartId: string, expectedVersion = 0): Request {
  return new Request("https://local.invalid/api/catalogue/part", {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      "x-rigstage-catalogue-part-id": targetPartId,
    },
    body: JSON.stringify({ action: "archive", expectedVersion }),
  });
}

function rejectionRequest(assetId: string, expectedVersion: number): Request {
  return new Request("https://local.invalid/api/assets/item/review", {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      "x-rigstage-asset-id": assetId,
    },
    body: JSON.stringify({
      action: "reject",
      expectedVersion,
      completedChecks: [],
      dimensionsMm: { width: null, height: null, depth: null },
    }),
  });
}

async function seedWorkspace(fixture: WorkspaceFixture): Promise<void> {
  await env.DB.batch([
    env.DB.prepare(
      `INSERT OR IGNORE INTO workspaces (id, slug, name)
       VALUES (?1, ?2, ?3)`,
    ).bind(fixture.workspaceId, fixture.slug, "Catalogue Write Fixture"),
    env.DB.prepare(
      `INSERT OR IGNORE INTO users (id, email, display_name, last_workspace_id)
       VALUES (?1, ?2, ?3, ?4)`,
    ).bind(
      fixture.userId,
      `${fixture.userId}@example.invalid`,
      "Catalogue Write Fixture",
      fixture.workspaceId,
    ),
    env.DB.prepare(
      `INSERT OR IGNORE INTO workspace_memberships (workspace_id, user_id, role)
       VALUES (?1, ?2, ?3)`,
    ).bind(fixture.workspaceId, fixture.userId, fixture.role),
  ]);
}

async function seedFixtures(): Promise<void> {
  await seedWorkspace(protectedFixture);
  await seedWorkspace(foreignFixture);
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO catalog_parts (
         id, workspace_id, sku, category, manufacturer, model,
         price_minor, stock_status, stock_count, specifications_json,
         specification_status, created_by, updated_by
       ) VALUES (
         ?1, ?2, 'LOCKED-CATEGORY-001', 'case', 'Fixture', 'Referenced Case',
         89900, 'in_stock', 4, '{}', 'verified', ?3, ?3
       )`,
    ).bind(partId, protectedFixture.workspaceId, protectedFixture.userId),
    env.DB.prepare(
      `INSERT INTO builds (
         id, workspace_id, name, mutation_token, created_by, updated_by
       ) VALUES (?1, ?2, 'Referenced Build', ?3, ?4, ?4)`,
    ).bind(
      buildId,
      protectedFixture.workspaceId,
      "catalogue-write-build-mutation",
      protectedFixture.userId,
    ),
    env.DB.prepare(
      `INSERT INTO build_items (
         workspace_id, build_id, category, catalog_part_id
       ) VALUES (?1, ?2, 'case', ?3)`,
    ).bind(protectedFixture.workspaceId, buildId, partId),
  ]);
}

async function seedReservedGenerationFixture(suffix: string): Promise<{
  actor: WorkspaceFixture;
  assetId: string;
  jobId: string;
  modelObjectKey: string;
  partId: string;
}> {
  const actor: WorkspaceFixture = {
    role: "owner",
    slug: `catalogue-generation-reserved-${suffix}`,
    userId: `user-catalogue-generation-reserved-${suffix}`,
    workspaceId: `workspace-catalogue-generation-reserved-${suffix}`,
  };
  const reservedPartId = `part-catalogue-generation-reserved-${suffix}`;
  const reservedAssetId = `asset-catalogue-generation-reserved-${suffix}`;
  const reservedJobId = `generation-catalogue-generation-reserved-${suffix}`;
  const sourceSha256 = "c".repeat(64);
  const modelSha256 = "d".repeat(64);
  const modelObjectKey = `workspaces/${actor.workspaceId}/assets/${reservedAssetId}/model/synthetic`;
  await seedWorkspace(actor);
  await seedWorkspace(foreignFixture);
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO catalog_parts (
         id, workspace_id, sku, category, manufacturer, model,
         specifications_json, specification_status, created_by, updated_by
       ) VALUES (
         ?1, ?2, ?3, 'gpu', 'Fixture',
         'Reserved Generation GPU', '{}', 'verified', ?4, ?4
       )`,
    ).bind(
      reservedPartId,
      actor.workspaceId,
      `GENERATION-RESERVED-${suffix.toUpperCase()}`,
      actor.userId,
    ),
    env.DB.prepare(
      `INSERT INTO product_assets (
         id, workspace_id, catalog_part_id, status, quality, source_kind,
         completed_checks_json, source_rights_confirmed, review_version,
         source_object_key, source_content_type, source_size_bytes,
         source_sha256, created_by, updated_by
       ) VALUES (
         ?1, ?2, ?3, 'draft', 'draft', 'uploaded', '[]', 1, 2,
         ?4, 'image/png', 128, ?5, ?6, ?6
       )`,
    ).bind(
      reservedAssetId,
      actor.workspaceId,
      reservedPartId,
      `workspaces/${actor.workspaceId}/assets/${reservedAssetId}/source/synthetic`,
      sourceSha256,
      actor.userId,
    ),
    env.DB.prepare(
      `INSERT INTO generation_credit_accounts (
         workspace_id, available_units, reserved_units
       ) VALUES (?1, 1, 1)`,
    ).bind(actor.workspaceId),
    env.DB.prepare(
      `INSERT INTO generation_jobs (
         id, workspace_id, asset_id, requested_by, status, execution_mode,
         idempotency_key, workflow_instance_id, requested_review_version,
         input_sha256, max_cost_minor, max_provider_cost_units,
         actual_cost_minor, provider_cost_units, validation_code,
         output_object_key, output_content_type, output_size_bytes,
         output_sha256
       ) VALUES (
         ?1, ?2, ?3, ?4, 'awaiting_review', 'simulation', ?5, ?1, 2,
         ?6, 0, 1, 0, 1, 'GLB_VALID', ?7, 'model/gltf-binary', 256, ?8
       )`,
    ).bind(
      reservedJobId,
      actor.workspaceId,
      reservedAssetId,
      actor.userId,
      `catalogue-generation-reserved-request-${suffix}`,
      sourceSha256,
      modelObjectKey,
      modelSha256,
    ),
    env.DB.prepare(
      `INSERT INTO generation_job_entitlements (
         workspace_id, job_id, units, status
       ) VALUES (?1, ?2, 1, 'reserved')`,
    ).bind(actor.workspaceId, reservedJobId),
    env.DB.prepare(
      `INSERT INTO generation_credit_events (
         id, workspace_id, job_id, event_type, units, reason_code
       ) VALUES (?1, ?2, ?3, 'reserve', 1, 'generation_requested')`,
    ).bind(crypto.randomUUID(), actor.workspaceId, reservedJobId),
    env.DB.prepare(
      `UPDATE product_assets
       SET source_kind = 'generated', quality = 'unreviewed',
           source_rights_confirmed = 0, review_version = 3,
           model_object_key = ?1, model_content_type = 'model/gltf-binary',
           model_size_bytes = 256, model_sha256 = ?2
       WHERE workspace_id = ?3 AND id = ?4`,
    ).bind(modelObjectKey, modelSha256, actor.workspaceId, reservedAssetId),
  ]);
  return {
    actor,
    assetId: reservedAssetId,
    jobId: reservedJobId,
    modelObjectKey,
    partId: reservedPartId,
  };
}

describe("catalogue write runtime constraints", () => {
  it("maps referenced category changes and preserves guarded updates", async () => {
    await seedFixtures();

    await expect(
      catalogueMutationResponse(
        updateRequest(0, "cpu", "Invalid Category Change"),
        env.DB,
        context(protectedFixture),
        "request-catalogue-category-locked",
      ),
    ).rejects.toMatchObject({
      status: 409,
      code: "CATALOGUE_CATEGORY_LOCKED",
      message: expect.stringMatching(
        /不能更改類別.*category cannot be changed/iu,
      ),
    });

    expect(
      await env.DB.prepare(
        `SELECT category, model, record_version
         FROM catalog_parts
         WHERE workspace_id = ?1 AND id = ?2`,
      )
        .bind(protectedFixture.workspaceId, partId)
        .first(),
    ).toEqual({
      category: "case",
      model: "Referenced Case",
      record_version: 0,
    });
    expect(
      await env.DB.prepare(
        `SELECT category, catalog_part_id
         FROM build_items
         WHERE workspace_id = ?1 AND build_id = ?2`,
      )
        .bind(protectedFixture.workspaceId, buildId)
        .first(),
    ).toEqual({ category: "case", catalog_part_id: partId });

    const updated = await catalogueMutationResponse(
      updateRequest(0, "case", "Updated Referenced Case"),
      env.DB,
      context(protectedFixture),
      "request-catalogue-same-category",
    );
    expect(updated.status).toBe(200);
    await expect(updated.json()).resolves.toMatchObject({
      id: partId,
      category: "case",
      model: "Updated Referenced Case",
      version: 1,
    });

    await expect(
      catalogueMutationResponse(
        updateRequest(0, "case", "Stale Replay"),
        env.DB,
        context(protectedFixture),
        "request-catalogue-stale-replay",
      ),
    ).rejects.toMatchObject({
      status: 409,
      code: "CATALOGUE_VERSION_CONFLICT",
    });
    await expect(
      catalogueMutationResponse(
        updateRequest(1, "case", "Foreign Update"),
        env.DB,
        context(foreignFixture),
        "request-catalogue-foreign-update",
      ),
    ).rejects.toMatchObject({
      status: 404,
      code: "CATALOGUE_PART_NOT_FOUND",
    });

    expect(
      await env.DB.prepare(
        `SELECT category, model, record_version
         FROM catalog_parts
         WHERE workspace_id = ?1 AND id = ?2`,
      )
        .bind(protectedFixture.workspaceId, partId)
        .first(),
    ).toEqual({
      category: "case",
      model: "Updated Referenced Case",
      record_version: 1,
    });
    expect(
      await env.DB.prepare(
        `SELECT action, request_id
         FROM audit_events
         WHERE workspace_id = ?1 AND target_id = ?2`,
      )
        .bind(protectedFixture.workspaceId, partId)
        .all(),
    ).toMatchObject({
      results: [
        {
          action: "catalogue.part.update",
          request_id: "request-catalogue-same-category",
        },
      ],
    });
    expect(
      await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM audit_events WHERE workspace_id = ?1",
      )
        .bind(foreignFixture.workspaceId)
        .first(),
    ).toEqual({ count: 0 });
  });

  it("rejects a direct archive while generated review credit is reserved", async () => {
    const fixture = await seedReservedGenerationFixture("direct");

    await expect(
      env.DB.prepare(
        `UPDATE catalog_parts SET status = 'archived'
         WHERE workspace_id = ?1 AND id = ?2`,
      )
        .bind(fixture.actor.workspaceId, fixture.partId)
        .run(),
    ).rejects.toThrow(/CATALOGUE_GENERATION_RESERVED/u);
    expect(
      await env.DB.prepare(
        `SELECT status, record_version FROM catalog_parts
         WHERE workspace_id = ?1 AND id = ?2`,
      )
        .bind(fixture.actor.workspaceId, fixture.partId)
        .first(),
    ).toEqual({ status: "active", record_version: 0 });
  });

  it("keeps reserved review visible, hides it cross-workspace, and archives after rejection", async () => {
    const fixture = await seedReservedGenerationFixture("route");

    await expect(
      catalogueMutationResponse(
        archiveRequest(fixture.partId),
        env.DB,
        context(foreignFixture),
        "request-catalogue-generation-foreign",
      ),
    ).rejects.toMatchObject({
      status: 404,
      code: "CATALOGUE_PART_NOT_FOUND",
    });
    await expect(
      catalogueMutationResponse(
        archiveRequest(fixture.partId),
        env.DB,
        context(fixture.actor),
        "request-catalogue-generation-locked",
      ),
    ).rejects.toMatchObject({
      status: 409,
      code: "CATALOGUE_GENERATION_LOCKED",
      message: expect.stringMatching(/保留.*reserved credit/iu),
    });

    expect(
      await env.DB.prepare(
        `SELECT p.status, p.record_version, a.review_version,
                j.status AS job_status, e.status AS entitlement_status,
                c.available_units, c.reserved_units,
                (SELECT COUNT(*) FROM audit_events AS ae
                 WHERE ae.workspace_id = p.workspace_id
                   AND ae.target_id = p.id
                   AND ae.action = 'catalogue.part.archive') AS archive_audits
         FROM catalog_parts AS p
         INNER JOIN product_assets AS a
           ON a.workspace_id = p.workspace_id AND a.catalog_part_id = p.id
         INNER JOIN generation_jobs AS j
           ON j.workspace_id = a.workspace_id AND j.asset_id = a.id
         INNER JOIN generation_job_entitlements AS e
           ON e.workspace_id = j.workspace_id AND e.job_id = j.id
         INNER JOIN generation_credit_accounts AS c
           ON c.workspace_id = j.workspace_id
         WHERE p.workspace_id = ?1 AND p.id = ?2`,
      )
        .bind(fixture.actor.workspaceId, fixture.partId)
        .first(),
    ).toEqual({
      status: "active",
      record_version: 0,
      review_version: 3,
      job_status: "awaiting_review",
      entitlement_status: "reserved",
      available_units: 1,
      reserved_units: 1,
      archive_audits: 0,
    });

    const rejection = await assetReviewMutationResponse(
      rejectionRequest(fixture.assetId, 3),
      env.DB,
      env.PRIVATE_ASSETS,
      context(fixture.actor),
      "request-catalogue-generation-reject",
    );
    expect(rejection.status).toBe(200);
    await expect(rejection.json()).resolves.toMatchObject({
      id: fixture.assetId,
      status: "rejected",
      version: 4,
    });

    const archived = await catalogueMutationResponse(
      archiveRequest(fixture.partId),
      env.DB,
      context(fixture.actor),
      "request-catalogue-generation-archive",
    );
    expect(archived.status).toBe(204);
    expect(
      await env.DB.prepare(
        `SELECT p.status, p.record_version, a.status AS asset_status,
                a.review_version, j.status AS job_status, j.failure_code,
                e.status AS entitlement_status,
                c.available_units, c.reserved_units, c.released_units,
                (SELECT COUNT(*) FROM generation_credit_events AS ce
                 WHERE ce.workspace_id = j.workspace_id AND ce.job_id = j.id
                   AND ce.event_type = 'release') AS release_events,
                (SELECT COUNT(*) FROM audit_events AS ae
                 WHERE ae.workspace_id = p.workspace_id
                   AND ae.target_id = p.id
                   AND ae.action = 'catalogue.part.archive') AS archive_audits
         FROM catalog_parts AS p
         INNER JOIN product_assets AS a
           ON a.workspace_id = p.workspace_id AND a.catalog_part_id = p.id
         INNER JOIN generation_jobs AS j
           ON j.workspace_id = a.workspace_id AND j.asset_id = a.id
         INNER JOIN generation_job_entitlements AS e
           ON e.workspace_id = j.workspace_id AND e.job_id = j.id
         INNER JOIN generation_credit_accounts AS c
           ON c.workspace_id = j.workspace_id
         WHERE p.workspace_id = ?1 AND p.id = ?2`,
      )
        .bind(fixture.actor.workspaceId, fixture.partId)
        .first(),
    ).toEqual({
      status: "archived",
      record_version: 1,
      asset_status: "rejected",
      review_version: 4,
      job_status: "failed",
      failure_code: "GENERATION_REVIEW_REJECTED",
      entitlement_status: "released",
      available_units: 2,
      reserved_units: 0,
      released_units: 1,
      release_events: 1,
      archive_audits: 1,
    });
  });
});
