import { env } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";

import type { WorkspaceRole } from "../src/shared/domain/session";
import type { RequestContext } from "../src/worker/auth/workspace";
import { catalogueImportResponse } from "../src/worker/routes/catalogue-write";

type WorkspaceFixture = {
  role: WorkspaceRole;
  slug: string;
  userId: string;
  workspaceId: string;
};

const targetFixture: WorkspaceFixture = {
  role: "admin",
  slug: "catalogue-import-target",
  userId: "user-catalogue-import-target",
  workspaceId: "workspace-catalogue-import-target",
};

const foreignFixture: WorkspaceFixture = {
  role: "owner",
  slug: "catalogue-import-foreign",
  userId: "user-catalogue-import-foreign",
  workspaceId: "workspace-catalogue-import-foreign",
};

const csvHeader =
  "sku,category,manufacturer,model,price_hkd,stock_status,stock_count,specification_status,specifications_json";

const successfulCsv = `${csvHeader}
SHARED-SKU-001,case,Fixture,Target Shared Case,849.00,in_stock,6,verified,"{""supportedMotherboardFormFactors"":""ATX""}"
TARGET-CPU-001,cpu,Fixture,Target Processor,2199.00,low_stock,2,verified,"{""socket"":""AM5""}"`;

const rollbackCsv = `${csvHeader}
FRESH-ROLLBACK-001,case,Fixture,Rollback Case,799.00,in_stock,3,verified,{}
ARCHIVED-SKU-001,cpu,Fixture,Archived Collision,1799.00,in_stock,4,verified,{}`;

function context(fixture: WorkspaceFixture): RequestContext {
  return {
    user: {
      id: fixture.userId,
      email: `${fixture.userId}@example.invalid`,
      displayName: "Catalogue Import Fixture",
    },
    currentWorkspace: {
      id: fixture.workspaceId,
      slug: fixture.slug,
      name: "Catalogue Import Fixture",
      locale: "zh-Hant-HK",
      currency: "HKD",
      role: fixture.role,
    },
    workspaces: [],
  };
}

function importRequest(csv: string): Request {
  return new Request("https://local.invalid/api/catalogue/import", {
    method: "POST",
    headers: { "content-type": "text/csv; charset=utf-8" },
    body: csv,
  });
}

async function seedWorkspace(fixture: WorkspaceFixture): Promise<void> {
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO workspaces (id, slug, name) VALUES (?1, ?2, ?3)",
    ).bind(fixture.workspaceId, fixture.slug, "Catalogue Import Fixture"),
    env.DB.prepare(
      `INSERT INTO users (id, email, display_name, last_workspace_id)
       VALUES (?1, ?2, ?3, ?4)`,
    ).bind(
      fixture.userId,
      `${fixture.userId}@example.invalid`,
      "Catalogue Import Fixture",
      fixture.workspaceId,
    ),
    env.DB.prepare(
      `INSERT INTO workspace_memberships (workspace_id, user_id, role)
       VALUES (?1, ?2, ?3)`,
    ).bind(fixture.workspaceId, fixture.userId, fixture.role),
  ]);
}

async function seedFixtures(): Promise<void> {
  await seedWorkspace(targetFixture);
  await seedWorkspace(foreignFixture);
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO catalog_parts (
         id, workspace_id, sku, category, manufacturer, model,
         specifications_json, specification_status, created_by, updated_by
       ) VALUES (
         'part-catalogue-import-foreign', ?1, 'SHARED-SKU-001', 'case',
         'Fixture', 'Foreign Shared Case', '{}', 'verified', ?2, ?2
       )`,
    ).bind(foreignFixture.workspaceId, foreignFixture.userId),
    env.DB.prepare(
      `INSERT INTO catalog_parts (
         id, workspace_id, sku, category, manufacturer, model, status,
         specifications_json, specification_status, created_by, updated_by
       ) VALUES (
         'part-catalogue-import-archived', ?1, 'ARCHIVED-SKU-001', 'cpu',
         'Fixture', 'Archived Processor', 'archived', '{}', 'verified', ?2, ?2
       )`,
    ).bind(targetFixture.workspaceId, targetFixture.userId),
  ]);
}

describe("catalogue import runtime transactions", () => {
  beforeAll(async () => {
    await seedFixtures();
  });

  it("scopes SKU uniqueness by workspace and rejects a replay without writes", async () => {
    const response = await catalogueImportResponse(
      importRequest(successfulCsv),
      env.DB,
      context(targetFixture),
      "request-catalogue-import-success",
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      created: expect.arrayContaining([
        expect.objectContaining({ sku: "SHARED-SKU-001", version: 0 }),
        expect.objectContaining({ sku: "TARGET-CPU-001", version: 0 }),
      ]),
    });
    expect(
      await env.DB.prepare(
        `SELECT COUNT(*) AS count
         FROM catalog_parts
         WHERE workspace_id = ?1 AND sku IN ('SHARED-SKU-001', 'TARGET-CPU-001')`,
      )
        .bind(targetFixture.workspaceId)
        .first(),
    ).toEqual({ count: 2 });
    expect(
      await env.DB.prepare(
        `SELECT COUNT(*) AS count
         FROM audit_events
         WHERE workspace_id = ?1 AND request_id = ?2
           AND action = 'catalogue.part.import'`,
      )
        .bind(targetFixture.workspaceId, "request-catalogue-import-success")
        .first(),
    ).toEqual({ count: 2 });

    await expect(
      catalogueImportResponse(
        importRequest(successfulCsv),
        env.DB,
        context(targetFixture),
        "request-catalogue-import-replay",
      ),
    ).rejects.toMatchObject({
      status: 409,
      code: "CATALOGUE_SKU_CONFLICT",
    });
    expect(
      await env.DB.prepare(
        `SELECT COUNT(*) AS count
         FROM audit_events
         WHERE workspace_id = ?1 AND request_id = ?2`,
      )
        .bind(targetFixture.workspaceId, "request-catalogue-import-replay")
        .first(),
    ).toEqual({ count: 0 });
  });

  it("rolls back every row and audit when a later insert conflicts", async () => {
    await expect(
      catalogueImportResponse(
        importRequest(rollbackCsv),
        env.DB,
        context(targetFixture),
        "request-catalogue-import-rollback",
      ),
    ).rejects.toMatchObject({
      status: 409,
      code: "CATALOGUE_SKU_CONFLICT",
    });

    expect(
      await env.DB.prepare(
        `SELECT sku, status
         FROM catalog_parts
         WHERE workspace_id = ?1
           AND sku IN ('FRESH-ROLLBACK-001', 'ARCHIVED-SKU-001')
         ORDER BY sku`,
      )
        .bind(targetFixture.workspaceId)
        .all(),
    ).toMatchObject({
      results: [{ sku: "ARCHIVED-SKU-001", status: "archived" }],
    });
    expect(
      await env.DB.prepare(
        `SELECT COUNT(*) AS count
         FROM audit_events
         WHERE workspace_id = ?1 AND request_id = ?2`,
      )
        .bind(targetFixture.workspaceId, "request-catalogue-import-rollback")
        .first(),
    ).toEqual({ count: 0 });
  });
});
