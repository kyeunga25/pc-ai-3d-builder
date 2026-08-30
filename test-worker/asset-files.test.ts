import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import type { WorkspaceRole } from "../src/shared/domain/session";
import {
  createAlternateSyntheticSourcePng,
  createSyntheticSourcePng,
} from "../src/shared/domain/synthetic-image";
import type { RequestContext } from "../src/worker/auth/workspace";
import { sha256Hex } from "../src/worker/lib/digest";
import { assetGenerationCreditReleasedHeader } from "../src/shared/lib/asset-target";
import {
  assetFileRemoveResponse,
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

function replacementRequest(
  expectedVersion = 0,
  sourceView: "back" | "front" | "left" | "three-quarter" = "front",
): Request {
  return new Request("https://local.invalid/api/assets/item/file", {
    method: "PUT",
    headers: {
      "content-type": "image/png",
      "x-rigstage-asset-file-kind": "source",
      "x-rigstage-asset-id": assetId,
      "x-rigstage-expected-version": String(expectedVersion),
      "x-rigstage-asset-source-view": sourceView,
    },
    body: replacementBytes.buffer as ArrayBuffer,
  });
}

function fileReadRequest(
  sourceView: "back" | "front" | "left" | "three-quarter" = "front",
): Request {
  return new Request("https://local.invalid/api/assets/item/file", {
    headers: {
      "x-rigstage-asset-file-kind": "source",
      "x-rigstage-asset-id": assetId,
      "x-rigstage-asset-source-view": sourceView,
    },
  });
}

function removalRequest(
  expectedVersion: number,
  sourceView: "back" | "front" | "left" | "three-quarter" = "front",
): Request {
  return new Request("https://local.invalid/api/assets/item/file", {
    method: "DELETE",
    headers: {
      "x-rigstage-asset-file-kind": "source",
      "x-rigstage-asset-id": assetId,
      "x-rigstage-expected-version": String(expectedVersion),
      "x-rigstage-asset-source-view": sourceView,
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
  it("isolates canonical and additional source-file reads and replacements by workspace", async () => {
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

    const foreignReplacementRequest = new Request(
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
        foreignReplacementRequest,
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
        sources: {
          front: {
            contentType: "image/png",
            sizeBytes: replacementBytes.length,
          },
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
    const currentFrontObjectKey = recoveredState?.source_object_key;
    if (!currentFrontObjectKey) {
      throw new Error("Synthetic front-source fixture was not stored.");
    }
    expect(recoveredState?.source_object_key).not.toBe(sourceObjectKey);
    expect(await env.PRIVATE_ASSETS.head(sourceObjectKey)).toBeNull();
    expect(
      await env.PRIVATE_ASSETS.list({
        prefix: `workspaces/${protectedFixture.workspaceId}/`,
      }),
    ).toMatchObject({ objects: [expect.any(Object)] });

    const createdResponse = await assetFileUploadResponse(
      replacementRequest(1, "back"),
      env.DB,
      env.PRIVATE_ASSETS,
      context(protectedFixture),
      "request-source-back-create",
    );
    expect(createdResponse.status).toBe(200);
    await expect(createdResponse.json()).resolves.toMatchObject({
      id: assetId,
      version: 2,
      sourceRightsConfirmed: false,
      completedChecks: [],
      files: {
        sources: {
          front: {
            contentType: "image/png",
            sizeBytes: replacementBytes.byteLength,
          },
          back: {
            contentType: "image/png",
            sizeBytes: replacementBytes.byteLength,
          },
          left: null,
          "three-quarter": null,
        },
      },
    });

    const storedBack = await env.DB.prepare(
      `SELECT object_key, content_type, size_bytes, sha256
       FROM product_asset_source_files
       WHERE workspace_id = ?1 AND asset_id = ?2 AND source_view = 'back'`,
    )
      .bind(protectedFixture.workspaceId, assetId)
      .first<{
        content_type: string;
        object_key: string;
        sha256: string;
        size_bytes: number;
      }>();
    expect(storedBack).toMatchObject({
      content_type: "image/png",
      sha256: replacementDigest,
      size_bytes: replacementBytes.byteLength,
    });
    expect(storedBack?.object_key).not.toBe(currentFrontObjectKey);
    expect(await env.PRIVATE_ASSETS.head(currentFrontObjectKey)).not.toBeNull();

    const readBack = await assetFileResponse(
      fileReadRequest("back"),
      env.DB,
      env.PRIVATE_ASSETS,
      context(protectedFixture),
    );
    expect(readBack.status).toBe(200);
    expect(readBack.headers.get("content-disposition")).toBe(
      'inline; filename="source-back.png"',
    );
    expect(new Uint8Array(await readBack.arrayBuffer())).toEqual(
      replacementBytes,
    );

    await expect(
      assetFileResponse(
        fileReadRequest("back"),
        env.DB,
        env.PRIVATE_ASSETS,
        context(requesterFixture),
      ),
    ).rejects.toMatchObject({ status: 404, code: "ASSET_NOT_FOUND" });

    const previousBackObjectKey = storedBack?.object_key;
    if (!previousBackObjectKey) {
      throw new Error("Synthetic back-source fixture was not stored.");
    }
    const backReplacementRequest = new Request(
      "https://local.invalid/api/assets/item/file",
      {
        method: "PUT",
        headers: {
          "content-type": "image/png",
          "x-rigstage-asset-file-kind": "source",
          "x-rigstage-asset-id": assetId,
          "x-rigstage-asset-source-view": "back",
          "x-rigstage-expected-version": "2",
        },
        body: sourceBytes.buffer as ArrayBuffer,
      },
    );
    const replacedResponse = await assetFileUploadResponse(
      backReplacementRequest,
      env.DB,
      env.PRIVATE_ASSETS,
      context(protectedFixture),
      "request-source-back-replace",
    );
    expect(replacedResponse.status).toBe(200);
    const replacedBack = await env.DB.prepare(
      `SELECT object_key, sha256
       FROM product_asset_source_files
       WHERE workspace_id = ?1 AND asset_id = ?2 AND source_view = 'back'`,
    )
      .bind(protectedFixture.workspaceId, assetId)
      .first<{ object_key: string; sha256: string }>();
    expect(replacedBack?.sha256).toBe(sourceDigest);
    expect(replacedBack?.object_key).not.toBe(previousBackObjectKey);
    expect(await env.PRIVATE_ASSETS.head(previousBackObjectKey)).toBeNull();
    expect(await env.PRIVATE_ASSETS.head(currentFrontObjectKey)).not.toBeNull();

    const auditRows = await env.DB.prepare(
      `SELECT metadata_json
       FROM audit_events
       WHERE workspace_id = ?1 AND target_id = ?2
         AND json_extract(metadata_json, '$.sourceView') = 'back'
       ORDER BY created_at, id`,
    )
      .bind(protectedFixture.workspaceId, assetId)
      .all<{ metadata_json: string }>();
    expect(auditRows.results).toHaveLength(2);
    expect(
      auditRows.results.every(
        (row) => JSON.parse(row.metadata_json).sourceView === "back",
      ),
    ).toBe(true);
    expect(JSON.stringify(auditRows.results)).not.toContain("workspaces/");

    await expect(
      assetFileRemoveResponse(
        removalRequest(3, "back"),
        env.DB,
        env.PRIVATE_ASSETS,
        context(requesterFixture),
        "request-source-back-foreign-remove",
      ),
    ).rejects.toMatchObject({ status: 404, code: "ASSET_NOT_FOUND" });
    expect(
      await env.PRIVATE_ASSETS.head(replacedBack?.object_key ?? ""),
    ).not.toBeNull();

    const removedBackResponse = await assetFileRemoveResponse(
      removalRequest(3, "back"),
      env.DB,
      env.PRIVATE_ASSETS,
      context(protectedFixture),
      "request-source-back-remove",
    );
    expect(removedBackResponse.status).toBe(200);
    expect(
      removedBackResponse.headers.get(assetGenerationCreditReleasedHeader),
    ).toBe("false");
    await expect(removedBackResponse.json()).resolves.toMatchObject({
      id: assetId,
      version: 4,
      sourceRightsConfirmed: false,
      completedChecks: [],
      files: {
        sources: {
          front: {
            contentType: "image/png",
            sizeBytes: replacementBytes.byteLength,
          },
          back: null,
        },
      },
    });
    expect(
      await env.DB.prepare(
        `SELECT COUNT(*) AS count
         FROM product_asset_source_files
         WHERE workspace_id = ?1 AND asset_id = ?2 AND source_view = 'back'`,
      )
        .bind(protectedFixture.workspaceId, assetId)
        .first(),
    ).toEqual({ count: 0 });
    expect(
      await env.PRIVATE_ASSETS.head(replacedBack?.object_key ?? ""),
    ).toBeNull();
    expect(await env.PRIVATE_ASSETS.head(currentFrontObjectKey)).not.toBeNull();
    await expect(
      assetFileRemoveResponse(
        removalRequest(3, "back"),
        env.DB,
        env.PRIVATE_ASSETS,
        context(protectedFixture),
        "request-source-back-remove-stale",
      ),
    ).rejects.toMatchObject({
      status: 409,
      code: "ASSET_VERSION_CONFLICT",
    });

    const removalAuditRows = await env.DB.prepare(
      `SELECT action, metadata_json
       FROM audit_events
       WHERE workspace_id = ?1 AND target_id = ?2
         AND action = 'asset.file.source.remove'`,
    )
      .bind(protectedFixture.workspaceId, assetId)
      .all<{ action: string; metadata_json: string }>();
    expect(removalAuditRows.results).toHaveLength(1);
    expect(JSON.parse(removalAuditRows.results[0]!.metadata_json)).toEqual({
      kind: "source",
      sourceView: "back",
      sizeBytes: sourceBytes.byteLength,
      reviewVersion: 4,
    });
    expect(JSON.stringify(removalAuditRows.results)).not.toContain(
      "workspaces/",
    );

    const removalRacingDb = databaseWithBeforeBatch(async () => {
      await env.DB.prepare(
        `UPDATE catalog_parts SET status = 'archived'
         WHERE workspace_id = ?1 AND id = ?2`,
      )
        .bind(protectedFixture.workspaceId, protectedFixture.partId)
        .run();
    });
    await expect(
      assetFileRemoveResponse(
        removalRequest(4),
        removalRacingDb,
        env.PRIVATE_ASSETS,
        context(protectedFixture),
        "request-source-front-remove-race",
      ),
    ).rejects.toMatchObject({ status: 404, code: "ASSET_NOT_FOUND" });
    expect(await env.PRIVATE_ASSETS.head(currentFrontObjectKey)).not.toBeNull();
    expect(
      await env.DB.prepare(
        `SELECT review_version, source_object_key
         FROM product_assets WHERE workspace_id = ?1 AND id = ?2`,
      )
        .bind(protectedFixture.workspaceId, assetId)
        .first(),
    ).toEqual({
      review_version: 4,
      source_object_key: currentFrontObjectKey,
    });

    await env.DB.prepare(
      `UPDATE catalog_parts SET status = 'active'
       WHERE workspace_id = ?1 AND id = ?2`,
    )
      .bind(protectedFixture.workspaceId, protectedFixture.partId)
      .run();
    const removedFrontResponse = await assetFileRemoveResponse(
      removalRequest(4),
      env.DB,
      env.PRIVATE_ASSETS,
      context(protectedFixture),
      "request-source-front-remove",
    );
    expect(removedFrontResponse.status).toBe(200);
    expect(
      removedFrontResponse.headers.get(assetGenerationCreditReleasedHeader),
    ).toBe("false");
    await expect(removedFrontResponse.json()).resolves.toMatchObject({
      id: assetId,
      version: 5,
      files: { sources: { front: null, back: null } },
    });
    expect(await env.PRIVATE_ASSETS.head(currentFrontObjectKey)).toBeNull();

    await expect(
      env.DB.prepare(
        `INSERT INTO product_asset_source_files (
           workspace_id, asset_id, source_view, object_key, content_type,
           size_bytes, sha256
         ) VALUES (?1, ?2, 'top', 'private/invalid-view', 'image/png', 1, ?3)`,
      )
        .bind(protectedFixture.workspaceId, assetId, "a".repeat(64))
        .run(),
    ).rejects.toThrow(/CHECK constraint failed/iu);

    await env.DB.prepare(
      `UPDATE catalog_parts SET status = 'archived'
       WHERE workspace_id = ?1 AND id = ?2`,
    )
      .bind(protectedFixture.workspaceId, protectedFixture.partId)
      .run();
    await expect(
      env.DB.prepare(
        `INSERT INTO product_asset_source_files (
           workspace_id, asset_id, source_view, object_key, content_type,
           size_bytes, sha256
         ) VALUES (?1, ?2, 'left', 'private/inactive-catalogue',
                   'image/png', 1, ?3)`,
      )
        .bind(protectedFixture.workspaceId, assetId, "b".repeat(64))
        .run(),
    ).rejects.toThrow(/ASSET_CATALOGUE_INACTIVE/iu);
    expect(
      await env.DB.prepare(
        `SELECT COUNT(*) AS count
         FROM product_asset_source_files
         WHERE workspace_id = ?1 AND asset_id = ?2 AND source_view = 'left'`,
      )
        .bind(protectedFixture.workspaceId, assetId)
        .first(),
    ).toEqual({ count: 0 });
  });
});
