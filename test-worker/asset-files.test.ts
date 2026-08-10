import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import type { WorkspaceRole } from "../src/shared/domain/session";
import type { RequestContext } from "../src/worker/auth/workspace";
import {
  assetFileResponse,
  assetFileUploadResponse,
} from "../src/worker/routes/asset-files";

type WorkspaceFixture = {
  partId: string;
  role: WorkspaceRole;
  slug: string;
  userId: string;
  workspaceId: string;
};

const protectedFixture: WorkspaceFixture = {
  partId: "part-file-isolation-protected",
  role: "viewer",
  slug: "file-isolation-protected",
  userId: "user-file-isolation-protected",
  workspaceId: "workspace-file-isolation-protected",
};

const requesterFixture: WorkspaceFixture = {
  partId: "part-file-isolation-requester",
  role: "owner",
  slug: "file-isolation-requester",
  userId: "user-file-isolation-requester",
  workspaceId: "workspace-file-isolation-requester",
};

const assetId = "asset-file-isolation-protected";
const sourceBytes = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const sourceDigest = "f".repeat(64);
const sourceObjectKey =
  "workspaces/workspace-file-isolation-protected/assets/asset-file-isolation-protected/source/fixture";

function context(fixture: WorkspaceFixture): RequestContext {
  return {
    user: {
      id: fixture.userId,
      email: `${fixture.userId}@example.invalid`,
      displayName: "File Isolation Fixture",
    },
    currentWorkspace: {
      id: fixture.workspaceId,
      slug: fixture.slug,
      name: "File Isolation Fixture",
      locale: "zh-Hant-HK",
      currency: "HKD",
      role: fixture.role,
    },
    workspaces: [],
  };
}

async function seedWorkspace(fixture: WorkspaceFixture): Promise<void> {
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO workspaces (id, slug, name) VALUES (?1, ?2, ?3)",
    ).bind(fixture.workspaceId, fixture.slug, "File Isolation Fixture"),
    env.DB.prepare(
      `INSERT INTO users (id, email, display_name, last_workspace_id)
       VALUES (?1, ?2, ?3, ?4)`,
    ).bind(
      fixture.userId,
      `${fixture.userId}@example.invalid`,
      "File Isolation Fixture",
      fixture.workspaceId,
    ),
    env.DB.prepare(
      `INSERT INTO workspace_memberships (workspace_id, user_id, role)
       VALUES (?1, ?2, ?3)`,
    ).bind(fixture.workspaceId, fixture.userId, fixture.role),
    env.DB.prepare(
      `INSERT INTO catalog_parts (
         id, workspace_id, sku, category, manufacturer, model,
         specifications_json, specification_status, created_by, updated_by
       ) VALUES (?1, ?2, ?3, 'cooling', 'Fixture', 'Private File',
                 '{}', 'verified', ?4, ?4)`,
    ).bind(
      fixture.partId,
      fixture.workspaceId,
      `FILE-${fixture.slug}`,
      fixture.userId,
    ),
  ]);
}

async function seedFixtures(): Promise<void> {
  await seedWorkspace(protectedFixture);
  await seedWorkspace(requesterFixture);
  await env.DB.prepare(
    `INSERT INTO product_assets (
       id, workspace_id, catalog_part_id, status, quality, source_kind,
       completed_checks_json, source_rights_confirmed, review_version,
       source_object_key, source_content_type, source_size_bytes,
       source_sha256, created_by, updated_by
     ) VALUES (
       ?1, ?2, ?3, 'draft', 'draft', 'uploaded', '[]', 1, 0,
       ?4, 'image/png', ?5, ?6, ?7, ?7
     )`,
  )
    .bind(
      assetId,
      protectedFixture.workspaceId,
      protectedFixture.partId,
      sourceObjectKey,
      sourceBytes.byteLength,
      sourceDigest,
      protectedFixture.userId,
    )
    .run();
  await env.PRIVATE_ASSETS.put(sourceObjectKey, sourceBytes, {
    httpMetadata: { contentType: "image/png", cacheControl: "no-store" },
  });
}

describe("private asset file workspace isolation", () => {
  it("allows the owning workspace and hides reads and replacements from another", async () => {
    await seedFixtures();

    const allowed = await assetFileResponse(
      env.DB,
      env.PRIVATE_ASSETS,
      context(protectedFixture),
      assetId,
      "source",
    );
    expect(allowed.status).toBe(200);
    expect(new Uint8Array(await allowed.arrayBuffer())).toEqual(sourceBytes);

    await expect(
      assetFileResponse(
        env.DB,
        env.PRIVATE_ASSETS,
        context(requesterFixture),
        assetId,
        "source",
      ),
    ).rejects.toMatchObject({ status: 404, code: "ASSET_NOT_FOUND" });

    const replacement = new Request(
      `https://local.invalid/api/assets/${assetId}/files/source`,
      {
        method: "PUT",
        headers: {
          "content-type": "image/png",
          "x-rigstage-expected-version": "0",
        },
        body: sourceBytes.buffer as ArrayBuffer,
      },
    );
    await expect(
      assetFileUploadResponse(
        replacement,
        env.DB,
        env.PRIVATE_ASSETS,
        context(requesterFixture),
        assetId,
        "source",
        "request-file-isolation",
      ),
    ).rejects.toMatchObject({ status: 404, code: "ASSET_NOT_FOUND" });

    const protectedState = await env.DB.prepare(
      `SELECT review_version, source_object_key, source_sha256
       FROM product_assets WHERE workspace_id = ?1 AND id = ?2`,
    )
      .bind(protectedFixture.workspaceId, assetId)
      .first();
    expect(protectedState).toEqual({
      review_version: 0,
      source_object_key: sourceObjectKey,
      source_sha256: sourceDigest,
    });
    expect(
      await env.PRIVATE_ASSETS.list({
        prefix: `workspaces/${requesterFixture.workspaceId}/`,
      }),
    ).toMatchObject({ objects: [] });
    expect(
      await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM audit_events WHERE workspace_id = ?1",
      )
        .bind(requesterFixture.workspaceId)
        .first(),
    ).toEqual({ count: 0 });
    expect(await env.PRIVATE_ASSETS.get(sourceObjectKey)).not.toBeNull();
  });
});
