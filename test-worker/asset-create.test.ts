import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import type { WorkspaceRole } from "../src/shared/domain/session";
import { createSyntheticSourcePng } from "../src/shared/domain/synthetic-image";
import type { RequestContext } from "../src/worker/auth/workspace";
import { createAssetSourceResponse } from "../src/worker/routes/asset-files";

type WorkspaceFixture = {
  role: WorkspaceRole;
  slug: string;
  userId: string;
  workspaceId: string;
};

const targetFixture: WorkspaceFixture = {
  role: "staff",
  slug: "asset-create-target",
  userId: "user-asset-create-target",
  workspaceId: "workspace-asset-create-target",
};

const foreignFixture: WorkspaceFixture = {
  role: "owner",
  slug: "asset-create-foreign",
  userId: "user-asset-create-foreign",
  workspaceId: "workspace-asset-create-foreign",
};

const partId = "part-asset-create-race";
const sourceBytes = createSyntheticSourcePng();

function context(fixture: WorkspaceFixture): RequestContext {
  return {
    user: {
      id: fixture.userId,
      email: `${fixture.userId}@example.invalid`,
      displayName: "Asset Create Fixture",
    },
    currentWorkspace: {
      id: fixture.workspaceId,
      slug: fixture.slug,
      name: "Asset Create Fixture",
      locale: "zh-Hant-HK",
      currency: "HKD",
      role: fixture.role,
    },
    workspaces: [],
  };
}

function sourceRequest(): Request {
  return new Request("https://local.invalid/api/catalogue/part/source", {
    method: "POST",
    headers: {
      "content-type": "image/png",
      "x-rigstage-catalogue-part-id": partId,
    },
    body: sourceBytes.buffer as ArrayBuffer,
  });
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

async function seedWorkspace(fixture: WorkspaceFixture): Promise<void> {
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO workspaces (id, slug, name) VALUES (?1, ?2, ?3)",
    ).bind(fixture.workspaceId, fixture.slug, "Asset Create Fixture"),
    env.DB.prepare(
      `INSERT INTO users (id, email, display_name, last_workspace_id)
       VALUES (?1, ?2, ?3, ?4)`,
    ).bind(
      fixture.userId,
      `${fixture.userId}@example.invalid`,
      "Asset Create Fixture",
      fixture.workspaceId,
    ),
    env.DB.prepare(
      `INSERT INTO workspace_memberships (workspace_id, user_id, role)
       VALUES (?1, ?2, ?3)`,
    ).bind(fixture.workspaceId, fixture.userId, fixture.role),
  ]);
}

describe("asset creation runtime constraints", () => {
  it("rolls back an archive race, hides foreign parts, and recovers once active", async () => {
    await seedWorkspace(targetFixture);
    await seedWorkspace(foreignFixture);
    await env.DB.prepare(
      `INSERT INTO catalog_parts (
         id, workspace_id, sku, category, manufacturer, model,
         specifications_json, specification_status, created_by, updated_by
       ) VALUES (
         ?1, ?2, 'ASSET-CREATE-RACE-001', 'gpu', 'Fixture',
         'Asset Create Race GPU', '{}', 'verified', ?3, ?3
       )`,
    )
      .bind(partId, targetFixture.workspaceId, targetFixture.userId)
      .run();

    await expect(
      createAssetSourceResponse(
        sourceRequest(),
        env.DB,
        env.PRIVATE_ASSETS,
        context(foreignFixture),
        "request-asset-create-foreign",
      ),
    ).rejects.toMatchObject({
      status: 404,
      code: "CATALOGUE_PART_NOT_FOUND",
    });

    const racingDb = databaseWithBeforeBatch(async () => {
      await env.DB.prepare(
        `UPDATE catalog_parts SET status = 'archived'
         WHERE workspace_id = ?1 AND id = ?2`,
      )
        .bind(targetFixture.workspaceId, partId)
        .run();
    });
    await expect(
      createAssetSourceResponse(
        sourceRequest(),
        racingDb,
        env.PRIVATE_ASSETS,
        context(targetFixture),
        "request-asset-create-race",
      ),
    ).rejects.toMatchObject({
      status: 404,
      code: "CATALOGUE_PART_NOT_FOUND",
      message: expect.stringMatching(/找不到.*product/iu),
    });

    expect(
      await env.DB.prepare(
        `SELECT COUNT(*) AS count FROM product_assets
         WHERE workspace_id = ?1 AND catalog_part_id = ?2`,
      )
        .bind(targetFixture.workspaceId, partId)
        .first(),
    ).toEqual({ count: 0 });
    expect(
      await env.DB.prepare(
        `SELECT COUNT(*) AS count FROM audit_events
         WHERE workspace_id = ?1 AND request_id = ?2`,
      )
        .bind(targetFixture.workspaceId, "request-asset-create-race")
        .first(),
    ).toEqual({ count: 0 });
    expect(
      await env.PRIVATE_ASSETS.list({
        prefix: `workspaces/${targetFixture.workspaceId}/`,
      }),
    ).toMatchObject({ objects: [] });

    await env.DB.prepare(
      `UPDATE catalog_parts SET status = 'active'
       WHERE workspace_id = ?1 AND id = ?2`,
    )
      .bind(targetFixture.workspaceId, partId)
      .run();
    const recovered = await createAssetSourceResponse(
      sourceRequest(),
      env.DB,
      env.PRIVATE_ASSETS,
      context(targetFixture),
      "request-asset-create-recovery",
    );
    expect(recovered.status).toBe(201);
    await expect(recovered.json()).resolves.toMatchObject({
      part: { id: partId },
      status: "draft",
      files: {
        source: { contentType: "image/png", sizeBytes: sourceBytes.byteLength },
      },
    });

    await expect(
      createAssetSourceResponse(
        sourceRequest(),
        env.DB,
        env.PRIVATE_ASSETS,
        context(targetFixture),
        "request-asset-create-replay",
      ),
    ).rejects.toMatchObject({ status: 409, code: "ASSET_ALREADY_EXISTS" });
    expect(
      await env.PRIVATE_ASSETS.list({
        prefix: `workspaces/${targetFixture.workspaceId}/`,
      }),
    ).toMatchObject({ truncated: false, objects: [expect.any(Object)] });
    expect(
      await env.DB.prepare(
        `SELECT action, request_id FROM audit_events
         WHERE workspace_id = ?1 AND target_type = 'product_asset'`,
      )
        .bind(targetFixture.workspaceId)
        .all(),
    ).toMatchObject({
      results: [
        {
          action: "asset.file.source.create",
          request_id: "request-asset-create-recovery",
        },
      ],
    });
  });
});
