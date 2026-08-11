import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import type { WorkspaceRole } from "../src/shared/domain/session";
import {
  createAlternateSyntheticSourcePng,
  createSyntheticSourcePng,
} from "../src/shared/domain/synthetic-image";
import type { RequestContext } from "../src/worker/auth/workspace";
import { sha256Hex } from "../src/worker/lib/digest";
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
  role: "staff",
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
const sourceBytes = createSyntheticSourcePng();
const sourceDigest = await sha256Hex(sourceBytes);
const replacementBytes = createAlternateSyntheticSourcePng();
const replacementDigest = await sha256Hex(replacementBytes);
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

function replacementRequest(expectedVersion = 0): Request {
  return new Request("https://local.invalid/api/assets/item/file", {
    method: "PUT",
    headers: {
      "content-type": "image/png",
      "x-rigstage-asset-file-kind": "source",
      "x-rigstage-asset-id": assetId,
      "x-rigstage-expected-version": String(expectedVersion),
    },
    body: replacementBytes.buffer as ArrayBuffer,
  });
}

function fileReadRequest(): Request {
  return new Request("https://local.invalid/api/assets/item/file", {
    headers: {
      "x-rigstage-asset-file-kind": "source",
      "x-rigstage-asset-id": assetId,
    },
  });
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
      fileReadRequest(),
      env.DB,
      env.PRIVATE_ASSETS,
      context(protectedFixture),
    );
    expect(allowed.status).toBe(200);
    expect(new Uint8Array(await allowed.arrayBuffer())).toEqual(sourceBytes);

    await env.PRIVATE_ASSETS.put(sourceObjectKey, sourceBytes.slice(0, -1), {
      httpMetadata: { contentType: "image/png", cacheControl: "no-store" },
    });
    await expect(
      assetFileResponse(
        fileReadRequest(),
        env.DB,
        env.PRIVATE_ASSETS,
        context(protectedFixture),
      ),
    ).rejects.toMatchObject({ status: 404, code: "ASSET_FILE_NOT_FOUND" });

    await env.PRIVATE_ASSETS.put(sourceObjectKey, sourceBytes, {
      httpMetadata: { contentType: "image/jpeg", cacheControl: "no-store" },
    });
    await expect(
      assetFileResponse(
        fileReadRequest(),
        env.DB,
        env.PRIVATE_ASSETS,
        context(protectedFixture),
      ),
    ).rejects.toMatchObject({ status: 404, code: "ASSET_FILE_NOT_FOUND" });

    const checksumDriftBytes = sourceBytes.slice();
    checksumDriftBytes[checksumDriftBytes.byteLength - 1] = 0x01;
    await env.PRIVATE_ASSETS.put(sourceObjectKey, checksumDriftBytes, {
      httpMetadata: { contentType: "image/png", cacheControl: "no-store" },
    });
    await expect(
      assetFileResponse(
        fileReadRequest(),
        env.DB,
        env.PRIVATE_ASSETS,
        context(protectedFixture),
      ),
    ).rejects.toMatchObject({ status: 404, code: "ASSET_FILE_NOT_FOUND" });

    await env.PRIVATE_ASSETS.put(sourceObjectKey, sourceBytes, {
      httpMetadata: { contentType: "image/png", cacheControl: "no-store" },
    });
    const recovered = await assetFileResponse(
      fileReadRequest(),
      env.DB,
      env.PRIVATE_ASSETS,
      context(protectedFixture),
    );
    expect(recovered.status).toBe(200);
    expect(new Uint8Array(await recovered.arrayBuffer())).toEqual(sourceBytes);

    await expect(
      assetFileResponse(
        fileReadRequest(),
        env.DB,
        env.PRIVATE_ASSETS,
        context(requesterFixture),
      ),
    ).rejects.toMatchObject({ status: 404, code: "ASSET_NOT_FOUND" });

    const replacement = new Request(
      "https://local.invalid/api/assets/item/file",
      {
        method: "PUT",
        headers: {
          "content-type": "image/png",
          "x-rigstage-asset-file-kind": "source",
          "x-rigstage-asset-id": assetId,
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
    expect(
      await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM audit_events WHERE workspace_id = ?1",
      )
        .bind(protectedFixture.workspaceId)
        .first(),
    ).toEqual({ count: 0 });
    expect(await env.PRIVATE_ASSETS.get(sourceObjectKey)).not.toBeNull();

    const racingDb = databaseWithBeforeBatch(async () => {
      await env.DB.prepare(
        `UPDATE catalog_parts SET status = 'archived'
         WHERE workspace_id = ?1 AND id = ?2`,
      )
        .bind(protectedFixture.workspaceId, protectedFixture.partId)
        .run();
    });
    await expect(
      assetFileUploadResponse(
        replacementRequest(),
        racingDb,
        env.PRIVATE_ASSETS,
        context(protectedFixture),
        "request-file-archive-race",
      ),
    ).rejects.toMatchObject({ status: 404, code: "ASSET_NOT_FOUND" });
    expect(
      await env.DB.prepare(
        `SELECT review_version, source_object_key, source_sha256,
                (SELECT COUNT(*) FROM audit_events AS ae
                 WHERE ae.workspace_id = a.workspace_id AND ae.target_id = a.id)
                  AS audit_events
         FROM product_assets AS a
         WHERE workspace_id = ?1 AND id = ?2`,
      )
        .bind(protectedFixture.workspaceId, assetId)
        .first(),
    ).toEqual({
      review_version: 0,
      source_object_key: sourceObjectKey,
      source_sha256: sourceDigest,
      audit_events: 0,
    });
    expect(await env.PRIVATE_ASSETS.head(sourceObjectKey)).not.toBeNull();
    expect(
      await env.PRIVATE_ASSETS.list({
        prefix: `workspaces/${protectedFixture.workspaceId}/`,
      }),
    ).toMatchObject({
      objects: [expect.objectContaining({ key: sourceObjectKey })],
    });

    await env.DB.prepare(
      `UPDATE catalog_parts SET status = 'active'
       WHERE workspace_id = ?1 AND id = ?2`,
    )
      .bind(protectedFixture.workspaceId, protectedFixture.partId)
      .run();
    const recoveredUpload = await assetFileUploadResponse(
      replacementRequest(),
      env.DB,
      env.PRIVATE_ASSETS,
      context(protectedFixture),
      "request-file-archive-recovery",
    );
    expect(recoveredUpload.status).toBe(200);
    expect(replacementDigest).not.toBe(sourceDigest);
    await expect(recoveredUpload.json()).resolves.toMatchObject({
      id: assetId,
      version: 1,
      files: {
        source: {
          contentType: "image/png",
          sizeBytes: replacementBytes.length,
        },
      },
    });
    await expect(
      assetFileUploadResponse(
        replacementRequest(),
        env.DB,
        env.PRIVATE_ASSETS,
        context(protectedFixture),
        "request-file-archive-stale-replay",
      ),
    ).rejects.toMatchObject({
      status: 409,
      code: "ASSET_VERSION_CONFLICT",
    });
    const recoveredState = await env.DB.prepare(
      `SELECT review_version, source_object_key, source_sha256,
              (SELECT COUNT(*) FROM audit_events AS ae
               WHERE ae.workspace_id = a.workspace_id AND ae.target_id = a.id)
                AS audit_events
       FROM product_assets AS a
       WHERE workspace_id = ?1 AND id = ?2`,
    )
      .bind(protectedFixture.workspaceId, assetId)
      .first<{
        audit_events: number;
        review_version: number;
        source_object_key: string;
        source_sha256: string;
      }>();
    expect(recoveredState).toMatchObject({
      review_version: 1,
      source_sha256: replacementDigest,
      audit_events: 1,
    });
    expect(recoveredState?.source_object_key).not.toBe(sourceObjectKey);
    expect(await env.PRIVATE_ASSETS.head(sourceObjectKey)).toBeNull();
    expect(
      await env.PRIVATE_ASSETS.list({
        prefix: `workspaces/${protectedFixture.workspaceId}/`,
      }),
    ).toMatchObject({ objects: [expect.any(Object)] });
  });
});
