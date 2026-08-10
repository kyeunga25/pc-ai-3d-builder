import { env } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";

import { catalogParts, currentBuild } from "../src/shared/domain/mockData";
import type { CatalogPart } from "../src/shared/domain/schemas";
import type { WorkspaceRole } from "../src/shared/domain/session";
import type { RequestContext } from "../src/worker/auth/workspace";
import {
  buildCreateResponse,
  buildDetailResponse,
  buildExportResponse,
  buildMutationResponse,
} from "../src/worker/routes/builds";

type WorkspaceFixture = {
  role: WorkspaceRole;
  slug: string;
  userId: string;
  workspaceId: string;
};

const protectedFixture: WorkspaceFixture = {
  role: "owner",
  slug: "build-isolation-protected",
  userId: "user-build-isolation-protected",
  workspaceId: "workspace-build-isolation-protected",
};

const requesterFixture: WorkspaceFixture = {
  role: "owner",
  slug: "build-isolation-requester",
  userId: "user-build-isolation-requester",
  workspaceId: "workspace-build-isolation-requester",
};

const buildId = "build-runtime-isolation-fixture";
const selectedParts = catalogParts.filter((part) =>
  currentBuild.selectedPartIds.includes(part.id),
);

function context(fixture: WorkspaceFixture): RequestContext {
  return {
    user: {
      id: fixture.userId,
      email: `${fixture.userId}@example.invalid`,
      displayName: "Build Isolation Fixture",
    },
    currentWorkspace: {
      id: fixture.workspaceId,
      slug: fixture.slug,
      name: "Build Isolation Fixture",
      locale: "zh-Hant-HK",
      currency: "HKD",
      role: fixture.role,
    },
    workspaces: [],
  };
}

function catalogueInsert(
  fixture: WorkspaceFixture,
  part: CatalogPart,
): D1PreparedStatement {
  return env.DB.prepare(
    `INSERT INTO catalog_parts (
       id, workspace_id, sku, category, manufacturer, model,
       price_minor, stock_status, stock_count, specifications_json,
       specification_status, status, record_version, created_by, updated_by
     ) VALUES (
       ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10,
       ?11, ?12, ?13, ?14, ?14
     )`,
  ).bind(
    part.id,
    fixture.workspaceId,
    part.sku,
    part.category,
    part.manufacturer,
    part.model,
    part.priceMinor,
    part.stockStatus,
    part.stockCount,
    JSON.stringify(part.specifications),
    part.specificationStatus,
    part.catalogueStatus,
    part.version,
    fixture.userId,
  );
}

function updateRequest(
  expectedVersion: number,
  name: string,
  selectedPartIds: string[],
): Request {
  return new Request(`https://local.invalid/api/builds/${buildId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action: "update",
      expectedVersion,
      name,
      selectedPartIds,
    }),
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
    ).bind(fixture.workspaceId, fixture.slug, "Build Isolation Fixture"),
    env.DB.prepare(
      `INSERT INTO users (id, email, display_name, last_workspace_id)
       VALUES (?1, ?2, ?3, ?4)`,
    ).bind(
      fixture.userId,
      `${fixture.userId}@example.invalid`,
      "Build Isolation Fixture",
      fixture.workspaceId,
    ),
    env.DB.prepare(
      `INSERT INTO workspace_memberships (workspace_id, user_id, role)
       VALUES (?1, ?2, ?3)`,
    ).bind(fixture.workspaceId, fixture.userId, fixture.role),
  ]);
}

async function seedBuildFixture(): Promise<void> {
  await seedWorkspace(protectedFixture);
  await seedWorkspace(requesterFixture);
  await env.DB.batch([
    ...selectedParts.map((part) => catalogueInsert(protectedFixture, part)),
    env.DB.prepare(
      `INSERT INTO builds (
         id, workspace_id, name, mutation_token, created_by, updated_by
       ) VALUES (?1, ?2, ?3, ?4, ?5, ?5)`,
    ).bind(
      buildId,
      protectedFixture.workspaceId,
      "九類組件整合測試",
      "runtime-build-mutation-fixture",
      protectedFixture.userId,
    ),
    ...selectedParts.map((part) =>
      env.DB.prepare(
        `INSERT INTO build_items (
           workspace_id, build_id, category, catalog_part_id
         ) VALUES (?1, ?2, ?3, ?4)`,
      ).bind(protectedFixture.workspaceId, buildId, part.category, part.id),
    ),
  ]);
}

describe("persistent build runtime boundaries", () => {
  beforeAll(async () => {
    await seedBuildFixture();
  });

  it("exports for the owning workspace and hides the build from another", async () => {
    const detail = await buildDetailResponse(
      env.DB,
      context(protectedFixture),
      buildId,
    );
    expect(detail.status).toBe(200);
    await expect(detail.json()).resolves.toMatchObject({
      id: buildId,
      selectedParts: expect.arrayContaining([
        expect.objectContaining({ category: "case" }),
        expect.objectContaining({ category: "cpu" }),
        expect.objectContaining({ category: "psu" }),
      ]),
      summary: {
        errorCount: 0,
        passCount: 6,
        unknownCount: 0,
        warningCount: 0,
      },
      version: 0,
    });

    const exported = await buildExportResponse(
      env.DB,
      context(protectedFixture),
      buildId,
    );
    const exportedText = await exported.text();
    expect(exported.status).toBe(200);
    expect(exportedText).not.toContain(protectedFixture.workspaceId);
    expect(exportedText).not.toContain(buildId);
    expect(exportedText).not.toContain("priceMinor");
    expect(exportedText).not.toContain("stockStatus");
    expect(exportedText).not.toContain("assetId");

    await expect(
      buildDetailResponse(env.DB, context(requesterFixture), buildId),
    ).rejects.toMatchObject({ status: 404, code: "BUILD_NOT_FOUND" });
    await expect(
      buildExportResponse(env.DB, context(requesterFixture), buildId),
    ).rejects.toMatchObject({ status: 404, code: "BUILD_NOT_FOUND" });

    expect(
      await env.DB.prepare(
        `SELECT status, record_version
         FROM builds WHERE workspace_id = ?1 AND id = ?2`,
      )
        .bind(protectedFixture.workspaceId, buildId)
        .first(),
    ).toEqual({ status: "draft", record_version: 0 });
    expect(
      await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM audit_events WHERE workspace_id IN (?1, ?2)",
      )
        .bind(protectedFixture.workspaceId, requesterFixture.workspaceId)
        .first(),
    ).toEqual({ count: 0 });
  });

  it("allows warnings but blocks errors and unknown compatibility results", async () => {
    await env.DB.prepare(
      `UPDATE catalog_parts
       SET specifications_json = json_set(specifications_json, '$.capacityWatts', 500)
       WHERE workspace_id = ?1 AND category = 'psu'`,
    )
      .bind(protectedFixture.workspaceId)
      .run();

    const warningDetail = await buildDetailResponse(
      env.DB,
      context(protectedFixture),
      buildId,
    );
    await expect(warningDetail.json()).resolves.toMatchObject({
      summary: {
        errorCount: 0,
        passCount: 5,
        unknownCount: 0,
        warningCount: 1,
      },
    });
    await expect(
      buildExportResponse(env.DB, context(protectedFixture), buildId),
    ).resolves.toMatchObject({ status: 200 });

    await env.DB.prepare(
      `UPDATE catalog_parts
       SET specifications_json = json_set(specifications_json, '$.socket', 'LGA1851')
       WHERE workspace_id = ?1 AND category = 'cpu'`,
    )
      .bind(protectedFixture.workspaceId)
      .run();

    const errorDetail = await buildDetailResponse(
      env.DB,
      context(protectedFixture),
      buildId,
    );
    await expect(errorDetail.json()).resolves.toMatchObject({
      summary: {
        errorCount: 1,
        passCount: 4,
        unknownCount: 0,
        warningCount: 1,
      },
    });
    await expect(
      buildExportResponse(env.DB, context(protectedFixture), buildId),
    ).rejects.toMatchObject({ status: 409, code: "BUILD_EXPORT_BLOCKED" });

    await env.DB.prepare(
      `UPDATE catalog_parts
       SET specification_status = 'unverified'
       WHERE workspace_id = ?1 AND category = 'cpu'`,
    )
      .bind(protectedFixture.workspaceId)
      .run();

    const unknownDetail = await buildDetailResponse(
      env.DB,
      context(protectedFixture),
      buildId,
    );
    await expect(unknownDetail.json()).resolves.toMatchObject({
      summary: {
        errorCount: 0,
        passCount: 4,
        unknownCount: 1,
        warningCount: 1,
      },
    });
    await expect(
      buildExportResponse(env.DB, context(protectedFixture), buildId),
    ).rejects.toMatchObject({ status: 409, code: "BUILD_EXPORT_BLOCKED" });
  });

  it("applies one guarded replacement and rejects stale or foreign updates", async () => {
    const selectedPartIds = selectedParts.map((part) => part.id);
    const updated = await buildMutationResponse(
      updateRequest(0, "已核實版本更新", selectedPartIds),
      env.DB,
      context(protectedFixture),
      buildId,
      "request-build-runtime-update",
    );
    const updatedText = await updated.text();

    expect(updated.status).toBe(200);
    expect(JSON.parse(updatedText)).toMatchObject({
      id: buildId,
      name: "已核實版本更新",
      selectedParts: expect.arrayContaining(
        selectedPartIds.map((id) => expect.objectContaining({ id })),
      ),
      version: 1,
    });
    expect(updatedText).not.toContain("runtime-build-mutation-fixture");

    await expect(
      buildMutationResponse(
        updateRequest(0, "不可覆寫版本", []),
        env.DB,
        context(protectedFixture),
        buildId,
        "request-build-runtime-stale",
      ),
    ).rejects.toMatchObject({
      status: 409,
      code: "BUILD_VERSION_CONFLICT",
    });
    await expect(
      buildMutationResponse(
        updateRequest(1, "外部工作空間更新", []),
        env.DB,
        context(requesterFixture),
        buildId,
        "request-build-runtime-foreign",
      ),
    ).rejects.toMatchObject({ status: 404, code: "BUILD_NOT_FOUND" });

    expect(
      await env.DB.prepare(
        `SELECT name, record_version,
                (SELECT COUNT(*) FROM build_items AS bi
                 WHERE bi.workspace_id = b.workspace_id
                   AND bi.build_id = b.id) AS selected_count
         FROM builds AS b
         WHERE workspace_id = ?1 AND id = ?2`,
      )
        .bind(protectedFixture.workspaceId, buildId)
        .first(),
    ).toEqual({
      name: "已核實版本更新",
      record_version: 1,
      selected_count: 9,
    });
    expect(
      await env.DB.prepare(
        `SELECT COUNT(*) AS count
         FROM audit_events
         WHERE workspace_id = ?1 AND target_id = ?2
           AND action = 'build.update'`,
      )
        .bind(protectedFixture.workspaceId, buildId)
        .first(),
    ).toEqual({ count: 1 });
    expect(
      await env.DB.prepare(
        `SELECT COUNT(*) AS count
         FROM audit_events
         WHERE workspace_id = ?1 AND request_id = ?2`,
      )
        .bind(requesterFixture.workspaceId, "request-build-runtime-foreign")
        .first(),
    ).toEqual({ count: 0 });
  });

  it("rolls back creation when a selected part is archived before the batch", async () => {
    const racePartId = "part-build-create-archive-race";
    const requestId = "request-build-create-archive-race";
    const buildName = "建立競態保護組裝";
    await env.DB.prepare(
      `INSERT INTO catalog_parts (
         id, workspace_id, sku, category, manufacturer, model,
         specifications_json, specification_status, created_by, updated_by
       ) VALUES (
         ?1, ?2, 'BUILD-CREATE-RACE-001', 'storage', 'Fixture',
         'Create Race Storage', '{}', 'verified', ?3, ?3
       )`,
    )
      .bind(racePartId, protectedFixture.workspaceId, protectedFixture.userId)
      .run();
    const request = new Request("https://local.invalid/api/builds", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: buildName, selectedPartIds: [racePartId] }),
    });
    const racingDb = databaseWithBeforeBatch(async () => {
      await env.DB.prepare(
        `UPDATE catalog_parts SET status = 'archived'
         WHERE workspace_id = ?1 AND id = ?2`,
      )
        .bind(protectedFixture.workspaceId, racePartId)
        .run();
    });

    await expect(
      buildCreateResponse(
        request,
        racingDb,
        context(protectedFixture),
        requestId,
      ),
    ).rejects.toMatchObject({
      status: 409,
      code: "BUILD_SELECTION_INVALID",
    });
    expect(
      await env.DB.prepare(
        `SELECT COUNT(*) AS count FROM builds
         WHERE workspace_id = ?1 AND name = ?2`,
      )
        .bind(protectedFixture.workspaceId, buildName)
        .first(),
    ).toEqual({ count: 0 });
    expect(
      await env.DB.prepare(
        `SELECT COUNT(*) AS count FROM audit_events
         WHERE workspace_id = ?1 AND request_id = ?2`,
      )
        .bind(protectedFixture.workspaceId, requestId)
        .first(),
    ).toEqual({ count: 0 });
  });

  it("preserves the previous selection when replacement loses its active part", async () => {
    const originalPartId = "part-build-update-race-original";
    const replacementPartId = "part-build-update-race-replacement";
    const raceBuildId = "build-update-archive-race";
    const requestId = "request-build-update-archive-race";
    await env.DB.batch([
      ...[
        {
          id: originalPartId,
          sku: "BUILD-UPDATE-RACE-ORIGINAL",
          model: "Original Race Processor",
        },
        {
          id: replacementPartId,
          sku: "BUILD-UPDATE-RACE-REPLACEMENT",
          model: "Replacement Race Processor",
        },
      ].map((part) =>
        env.DB.prepare(
          `INSERT INTO catalog_parts (
             id, workspace_id, sku, category, manufacturer, model,
             specifications_json, specification_status, created_by, updated_by
           ) VALUES (?1, ?2, ?3, 'cpu', 'Fixture', ?4, '{}', 'verified', ?5, ?5)`,
        ).bind(
          part.id,
          protectedFixture.workspaceId,
          part.sku,
          part.model,
          protectedFixture.userId,
        ),
      ),
      env.DB.prepare(
        `INSERT INTO builds (
           id, workspace_id, name, mutation_token, created_by, updated_by
         ) VALUES (?1, ?2, 'Original Race Build', ?3, ?4, ?4)`,
      ).bind(
        raceBuildId,
        protectedFixture.workspaceId,
        "build-update-race-mutation",
        protectedFixture.userId,
      ),
      env.DB.prepare(
        `INSERT INTO build_items (
           workspace_id, build_id, category, catalog_part_id
         ) VALUES (?1, ?2, 'cpu', ?3)`,
      ).bind(protectedFixture.workspaceId, raceBuildId, originalPartId),
    ]);
    const request = new Request(
      `https://local.invalid/api/builds/${raceBuildId}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "update",
          expectedVersion: 0,
          name: "Invalid Race Replacement",
          selectedPartIds: [replacementPartId],
        }),
      },
    );
    const racingDb = databaseWithBeforeBatch(async () => {
      await env.DB.prepare(
        `UPDATE catalog_parts SET status = 'archived'
         WHERE workspace_id = ?1 AND id = ?2`,
      )
        .bind(protectedFixture.workspaceId, replacementPartId)
        .run();
    });

    await expect(
      buildMutationResponse(
        request,
        racingDb,
        context(protectedFixture),
        raceBuildId,
        requestId,
      ),
    ).rejects.toMatchObject({
      status: 409,
      code: "BUILD_SELECTION_INVALID",
    });
    expect(
      await env.DB.prepare(
        `SELECT b.name, b.record_version, bi.catalog_part_id
         FROM builds AS b
         INNER JOIN build_items AS bi
           ON bi.workspace_id = b.workspace_id AND bi.build_id = b.id
         WHERE b.workspace_id = ?1 AND b.id = ?2`,
      )
        .bind(protectedFixture.workspaceId, raceBuildId)
        .first(),
    ).toEqual({
      name: "Original Race Build",
      record_version: 0,
      catalog_part_id: originalPartId,
    });
    expect(
      await env.DB.prepare(
        `SELECT COUNT(*) AS count FROM audit_events
         WHERE workspace_id = ?1 AND request_id = ?2`,
      )
        .bind(protectedFixture.workspaceId, requestId)
        .first(),
    ).toEqual({ count: 0 });
  });
});
