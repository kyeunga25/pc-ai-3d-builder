import { env } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";

import { catalogParts, currentBuild } from "../src/shared/domain/mockData";
import type { CatalogPart } from "../src/shared/domain/schemas";
import type { WorkspaceRole } from "../src/shared/domain/session";
import type { RequestContext } from "../src/worker/auth/workspace";
import {
  buildDetailResponse,
  buildExportResponse,
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
});
