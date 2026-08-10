import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import {
  assetReviewChecks,
  type AssetReviewCheck,
} from "../src/shared/domain/assets";
import type { WorkspaceRole } from "../src/shared/domain/session";
import type { RequestContext } from "../src/worker/auth/workspace";
import { assetReviewMutationResponse } from "../src/worker/routes/assets";

type ActorFixture = {
  role: WorkspaceRole;
  slug: string;
  userId: string;
  workspaceId: string;
};

const protectedWorkspaceId = "workspace-asset-review-protected";
const protectedSlug = "asset-review-protected";

const staffFixture: ActorFixture = {
  role: "staff",
  slug: protectedSlug,
  userId: "user-asset-review-staff",
  workspaceId: protectedWorkspaceId,
};

const adminFixture: ActorFixture = {
  role: "admin",
  slug: protectedSlug,
  userId: "user-asset-review-admin",
  workspaceId: protectedWorkspaceId,
};

const foreignFixture: ActorFixture = {
  role: "owner",
  slug: "asset-review-foreign",
  userId: "user-asset-review-foreign",
  workspaceId: "workspace-asset-review-foreign",
};

const partId = "part-asset-review-runtime";
const assetId = "asset-review-runtime";
const sourceObjectKey =
  "workspaces/workspace-asset-review-protected/assets/asset-review-runtime/source/synthetic";
const modelObjectKey =
  "workspaces/workspace-asset-review-protected/assets/asset-review-runtime/model/synthetic";

function context(fixture: ActorFixture): RequestContext {
  return {
    user: {
      id: fixture.userId,
      email: `${fixture.userId}@example.invalid`,
      displayName: "Asset Review Fixture",
    },
    currentWorkspace: {
      id: fixture.workspaceId,
      slug: fixture.slug,
      name: "Asset Review Fixture",
      locale: "zh-Hant-HK",
      currency: "HKD",
      role: fixture.role,
    },
    workspaces: [],
  };
}

function reviewRequest(
  action: "save_draft" | "approve" | "reject",
  expectedVersion: number,
  completedChecks: AssetReviewCheck[],
  dimensionsMm: {
    width: number | null;
    height: number | null;
    depth: number | null;
  },
): Request {
  return new Request(`https://local.invalid/api/assets/${assetId}/review`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action,
      expectedVersion,
      completedChecks,
      dimensionsMm,
    }),
  });
}

async function seedFixtures(): Promise<void> {
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO workspaces (id, slug, name) VALUES (?1, ?2, ?3)",
    ).bind(protectedWorkspaceId, protectedSlug, "Asset Review Fixture"),
    env.DB.prepare(
      "INSERT INTO workspaces (id, slug, name) VALUES (?1, ?2, ?3)",
    ).bind(
      foreignFixture.workspaceId,
      foreignFixture.slug,
      "Asset Review Foreign Fixture",
    ),
    ...[staffFixture, adminFixture, foreignFixture].flatMap((fixture) => [
      env.DB.prepare(
        `INSERT INTO users (id, email, display_name, last_workspace_id)
         VALUES (?1, ?2, ?3, ?4)`,
      ).bind(
        fixture.userId,
        `${fixture.userId}@example.invalid`,
        "Asset Review Fixture",
        fixture.workspaceId,
      ),
      env.DB.prepare(
        `INSERT INTO workspace_memberships (workspace_id, user_id, role)
         VALUES (?1, ?2, ?3)`,
      ).bind(fixture.workspaceId, fixture.userId, fixture.role),
    ]),
    env.DB.prepare(
      `INSERT INTO catalog_parts (
         id, workspace_id, sku, category, manufacturer, model,
         specifications_json, specification_status, created_by, updated_by
       ) VALUES (
         ?1, ?2, 'REVIEW-RUNTIME-001', 'cooling', 'Fixture',
         'Uploaded Review Model', '{"coolerHeightMm":162}', 'verified', ?3, ?3
       )`,
    ).bind(partId, protectedWorkspaceId, staffFixture.userId),
    env.DB.prepare(
      `INSERT INTO product_assets (
         id, workspace_id, catalog_part_id, status, quality, source_kind,
         completed_checks_json, source_rights_confirmed, review_version,
         source_object_key, source_content_type, source_size_bytes,
         source_sha256, model_object_key, model_content_type,
         model_size_bytes, model_sha256, created_by, updated_by
       ) VALUES (
         ?1, ?2, ?3, 'draft', 'draft', 'uploaded', '[]', 0, 0,
         ?4, 'image/png', 128, ?5, ?6, 'model/gltf-binary', 256, ?7, ?8, ?8
       )`,
    ).bind(
      assetId,
      protectedWorkspaceId,
      partId,
      sourceObjectKey,
      "a".repeat(64),
      modelObjectKey,
      "b".repeat(64),
      staffFixture.userId,
    ),
  ]);
}

describe("asset review runtime boundaries", () => {
  it("allows a staff draft and applies one workspace-scoped admin approval", async () => {
    await seedFixtures();

    const draft = await assetReviewMutationResponse(
      reviewRequest("save_draft", 0, ["model_identity", "source_rights"], {
        width: 129,
        height: null,
        depth: null,
      }),
      env.DB,
      context(staffFixture),
      assetId,
      "request-asset-review-draft",
    );
    const draftText = await draft.text();

    expect(draft.status).toBe(200);
    expect(JSON.parse(draftText)).toMatchObject({
      id: assetId,
      status: "draft",
      quality: "draft",
      completedChecks: ["model_identity", "source_rights"],
      sourceRightsConfirmed: true,
      version: 1,
    });
    expect(draftText).not.toContain(protectedWorkspaceId);
    expect(draftText).not.toContain(sourceObjectKey);
    expect(draftText).not.toContain(modelObjectKey);
    expect(draftText).not.toContain("a".repeat(64));
    expect(draftText).not.toContain("b".repeat(64));

    const approvalRequest = () =>
      reviewRequest("approve", 1, [...assetReviewChecks], {
        width: 129,
        height: 162,
        depth: 138,
      });

    await expect(
      assetReviewMutationResponse(
        approvalRequest(),
        env.DB,
        context(staffFixture),
        assetId,
        "request-asset-review-staff-approval",
      ),
    ).rejects.toMatchObject({ status: 403, code: "ROLE_FORBIDDEN" });
    await expect(
      assetReviewMutationResponse(
        approvalRequest(),
        env.DB,
        context(foreignFixture),
        assetId,
        "request-asset-review-foreign",
      ),
    ).rejects.toMatchObject({ status: 404, code: "ASSET_NOT_FOUND" });

    const approval = await assetReviewMutationResponse(
      approvalRequest(),
      env.DB,
      context(adminFixture),
      assetId,
      "request-asset-review-approval",
    );
    expect(approval.status).toBe(200);
    await expect(approval.json()).resolves.toMatchObject({
      status: "approved",
      quality: "approved",
      completedChecks: assetReviewChecks,
      dimensionsMm: { width: 129, height: 162, depth: 138 },
      sourceRightsConfirmed: true,
      version: 2,
    });

    await expect(
      assetReviewMutationResponse(
        approvalRequest(),
        env.DB,
        context(adminFixture),
        assetId,
        "request-asset-review-replay",
      ),
    ).rejects.toMatchObject({
      status: 409,
      code: "ASSET_VERSION_CONFLICT",
    });

    expect(
      await env.DB.prepare(
        `SELECT status, quality, review_version, updated_by, approved_by,
                source_rights_confirmed
         FROM product_assets
         WHERE workspace_id = ?1 AND id = ?2`,
      )
        .bind(protectedWorkspaceId, assetId)
        .first(),
    ).toEqual({
      status: "approved",
      quality: "approved",
      review_version: 2,
      updated_by: adminFixture.userId,
      approved_by: adminFixture.userId,
      source_rights_confirmed: 1,
    });
    expect(
      await env.DB.prepare(
        `SELECT decision, review_version, reviewer_user_id
         FROM asset_review_events
         WHERE workspace_id = ?1 AND asset_id = ?2
         ORDER BY review_version`,
      )
        .bind(protectedWorkspaceId, assetId)
        .all(),
    ).toMatchObject({
      results: [
        {
          decision: "save_draft",
          review_version: 1,
          reviewer_user_id: staffFixture.userId,
        },
        {
          decision: "approve",
          review_version: 2,
          reviewer_user_id: adminFixture.userId,
        },
      ],
    });
    const auditHistory = await env.DB.prepare(
      `SELECT action, request_id
       FROM audit_events
       WHERE workspace_id = ?1 AND target_id = ?2
       ORDER BY created_at, action`,
    )
      .bind(protectedWorkspaceId, assetId)
      .all();
    expect(auditHistory.results).toHaveLength(2);
    expect(auditHistory.results).toEqual(
      expect.arrayContaining([
        {
          action: "asset.review.save_draft",
          request_id: "request-asset-review-draft",
        },
        {
          action: "asset.review.approve",
          request_id: "request-asset-review-approval",
        },
      ]),
    );
    expect(
      await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM audit_events WHERE workspace_id = ?1",
      )
        .bind(foreignFixture.workspaceId)
        .first(),
    ).toEqual({ count: 0 });
  });
});
