import {
  buildCreateInputSchema,
  buildListResponseSchema,
  buildMutationSchema,
  buildRecordIdPattern,
  buildRecordSchema,
  composeBuildRecord,
  isBuildExportReady,
  portableBuildExport,
  type BuildListItem,
  type BuildRecord,
} from "../../shared/domain/builds";
import {
  type CatalogPart,
  type ComponentCategory,
} from "../../shared/domain/schemas";
import type { WorkspaceRole } from "../../shared/domain/session";
import type { RequestContext } from "../auth/workspace";
import { ApiError } from "../lib/api-error";
import { readBoundedJson } from "../lib/request-body";
import { mapCatalogueRow, type CatalogueRow } from "./catalogue";

type BuildRow = {
  id: string;
  name: string;
  status: "draft" | "archived";
  record_version: number;
  updated_at: string;
};

type BuildListRow = BuildRow & {
  selected_count: number;
};

const buildPartSelect = `SELECT p.id, p.sku, p.category, p.manufacturer,
                                p.model, p.price_minor, p.stock_status,
                                p.stock_count, p.specifications_json,
                                p.specification_status, p.status,
                                p.record_version, a.id AS asset_id,
                                a.quality AS asset_quality,
                                a.status AS asset_review_status
                         FROM catalog_parts AS p
                         LEFT JOIN product_assets AS a
                           ON a.workspace_id = p.workspace_id
                          AND a.catalog_part_id = p.id`;

function writeRoleError(): ApiError {
  return new ApiError(
    403,
    "ROLE_FORBIDDEN",
    "你目前的工作空間角色無權修改組裝。",
  );
}

function assertWriteRole(role: WorkspaceRole): void {
  if (role === "viewer") {
    throw writeRoleError();
  }
}

function buildNotFound(): ApiError {
  return new ApiError(404, "BUILD_NOT_FOUND", "找不到所要求的組裝。");
}

function buildVersionConflict(): ApiError {
  return new ApiError(
    409,
    "BUILD_VERSION_CONFLICT",
    "組裝已由另一個操作更新，請重新載入後再試。",
  );
}

function validateBuildId(buildId: string): void {
  if (!buildRecordIdPattern.test(buildId)) {
    throw buildNotFound();
  }
}

async function findBuild(
  db: D1Database,
  workspaceId: string,
  buildId: string,
): Promise<BuildRow | null> {
  return db
    .prepare(
      `SELECT id, name, status, record_version, updated_at
       FROM builds
       WHERE workspace_id = ?1 AND id = ?2 AND status = 'draft'
       LIMIT 1`,
    )
    .bind(workspaceId, buildId)
    .first<BuildRow>();
}

async function loadBuildParts(
  db: D1Database,
  workspaceId: string,
  buildId: string,
): Promise<CatalogPart[]> {
  const result = await db
    .prepare(
      `${buildPartSelect}
       INNER JOIN build_items AS bi
         ON bi.workspace_id = p.workspace_id
        AND bi.catalog_part_id = p.id
       WHERE bi.workspace_id = ?1 AND bi.build_id = ?2
       ORDER BY CASE bi.category
         WHEN 'case' THEN 1
         WHEN 'motherboard' THEN 2
         WHEN 'cpu' THEN 3
         WHEN 'gpu' THEN 4
         WHEN 'memory' THEN 5
         WHEN 'cooling' THEN 6
         WHEN 'storage' THEN 7
         WHEN 'psu' THEN 8
         WHEN 'fans' THEN 9
         ELSE 10
       END`,
    )
    .bind(workspaceId, buildId)
    .all<CatalogueRow>();
  return result.results.map(mapCatalogueRow);
}

async function loadSelectedParts(
  db: D1Database,
  workspaceId: string,
  selectedPartIds: string[],
): Promise<CatalogPart[]> {
  if (selectedPartIds.length === 0) {
    return [];
  }
  const placeholders = selectedPartIds.map(() => "?").join(", ");
  const result = await db
    .prepare(
      `${buildPartSelect}
       WHERE p.workspace_id = ?
         AND p.status = 'active'
         AND p.id IN (${placeholders})`,
    )
    .bind(workspaceId, ...selectedPartIds)
    .all<CatalogueRow>();
  const parts = result.results.map(mapCatalogueRow);
  const categories = new Set<ComponentCategory>();
  if (
    parts.length !== selectedPartIds.length ||
    parts.some((part) => {
      const duplicate = categories.has(part.category);
      categories.add(part.category);
      return duplicate;
    })
  ) {
    throw new ApiError(
      409,
      "BUILD_SELECTION_INVALID",
      "組裝選擇包含不存在、已封存或重複類別的產品。",
    );
  }
  return parts;
}

async function loadBuildRecord(
  db: D1Database,
  workspaceId: string,
  buildId: string,
): Promise<BuildRecord> {
  const row = await findBuild(db, workspaceId, buildId);
  if (!row) {
    throw buildNotFound();
  }
  return composeBuildRecord({
    id: row.id,
    name: row.name,
    status: row.status,
    selectedParts: await loadBuildParts(db, workspaceId, buildId),
    version: row.record_version,
    updatedAt: row.updated_at,
  });
}

function buildItemInsert(
  db: D1Database,
  workspaceId: string,
  buildId: string,
  part: CatalogPart,
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO build_items (
         workspace_id, build_id, category, catalog_part_id
       )
       VALUES (?1, ?2, ?3, ?4)`,
    )
    .bind(workspaceId, buildId, part.category, part.id);
}

function guardedBuildItemInsert(
  db: D1Database,
  workspaceId: string,
  buildId: string,
  mutationToken: string,
  part: CatalogPart,
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO build_items (
         workspace_id, build_id, category, catalog_part_id
       )
       SELECT workspace_id, id, ?1, ?2
       FROM builds
       WHERE workspace_id = ?3
         AND id = ?4
         AND status = 'draft'
         AND mutation_token = ?5`,
    )
    .bind(part.category, part.id, workspaceId, buildId, mutationToken);
}

export async function buildListResponse(
  db: D1Database,
  context: RequestContext,
): Promise<Response> {
  const result = await db
    .prepare(
      `SELECT b.id, b.name, b.status, b.record_version, b.updated_at,
              COUNT(bi.catalog_part_id) AS selected_count
       FROM builds AS b
       LEFT JOIN build_items AS bi
         ON bi.workspace_id = b.workspace_id
        AND bi.build_id = b.id
       WHERE b.workspace_id = ?1 AND b.status = 'draft'
       GROUP BY b.id, b.name, b.status, b.record_version, b.updated_at
       ORDER BY b.updated_at DESC, b.id
       LIMIT 50`,
    )
    .bind(context.currentWorkspace.id)
    .all<BuildListRow>();
  const items: BuildListItem[] = result.results.map((row) => ({
    id: row.id,
    name: row.name,
    selectedCount: row.selected_count,
    version: row.record_version,
    updatedAt: row.updated_at,
  }));

  return Response.json(buildListResponseSchema.parse({ items }), {
    headers: { "cache-control": "no-store" },
  });
}

export async function buildDetailResponse(
  db: D1Database,
  context: RequestContext,
  buildId: string,
): Promise<Response> {
  validateBuildId(buildId);
  return Response.json(
    await loadBuildRecord(db, context.currentWorkspace.id, buildId),
    { headers: { "cache-control": "no-store" } },
  );
}

export async function buildCreateResponse(
  request: Request,
  db: D1Database,
  context: RequestContext,
  requestId: string,
): Promise<Response> {
  assertWriteRole(context.currentWorkspace.role);
  const parsed = buildCreateInputSchema.safeParse(
    await readBoundedJson(request),
  );
  if (!parsed.success) {
    throw new ApiError(400, "VALIDATION_ERROR", "組裝內容無效。");
  }
  const selectedParts = await loadSelectedParts(
    db,
    context.currentWorkspace.id,
    parsed.data.selectedPartIds,
  );
  const buildId = `build_${crypto.randomUUID()}`;
  const mutationToken = crypto.randomUUID();
  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `INSERT INTO builds (
           id, workspace_id, name, status, record_version, mutation_token,
           created_by, updated_by
         )
         VALUES (?1, ?2, ?3, 'draft', 0, ?4, ?5, ?5)`,
      )
      .bind(
        buildId,
        context.currentWorkspace.id,
        parsed.data.name,
        mutationToken,
        context.user.id,
      ),
    ...selectedParts.map((part) =>
      buildItemInsert(db, context.currentWorkspace.id, buildId, part),
    ),
    db
      .prepare(
        `INSERT INTO audit_events (
           id, workspace_id, user_id, action, target_type, target_id,
           request_id, metadata_json
         )
         SELECT ?1, workspace_id, ?2, 'build.create', 'build', id, ?3, ?4
         FROM builds
         WHERE workspace_id = ?5 AND id = ?6 AND mutation_token = ?7`,
      )
      .bind(
        crypto.randomUUID(),
        context.user.id,
        requestId,
        JSON.stringify({
          buildVersion: 0,
          selectedCount: selectedParts.length,
        }),
        context.currentWorkspace.id,
        buildId,
        mutationToken,
      ),
  ];
  await db.batch(statements);

  return Response.json(
    await loadBuildRecord(db, context.currentWorkspace.id, buildId),
    {
      status: 201,
      headers: { "cache-control": "no-store" },
    },
  );
}

export async function buildMutationResponse(
  request: Request,
  db: D1Database,
  context: RequestContext,
  buildId: string,
  requestId: string,
): Promise<Response> {
  assertWriteRole(context.currentWorkspace.role);
  validateBuildId(buildId);
  const parsed = buildMutationSchema.safeParse(await readBoundedJson(request));
  if (!parsed.success) {
    throw new ApiError(400, "VALIDATION_ERROR", "組裝內容無效。");
  }
  const input = parsed.data;
  const mutationToken = crypto.randomUUID();
  const nextVersion = input.expectedVersion + 1;
  const selectedParts =
    input.action === "update"
      ? await loadSelectedParts(
          db,
          context.currentWorkspace.id,
          input.selectedPartIds,
        )
      : [];

  const updateStatement =
    input.action === "update"
      ? db
          .prepare(
            `UPDATE builds
             SET name = ?1,
                 record_version = record_version + 1,
                 mutation_token = ?2,
                 updated_by = ?3,
                 updated_at = CURRENT_TIMESTAMP
             WHERE workspace_id = ?4
               AND id = ?5
               AND status = 'draft'
               AND record_version = ?6`,
          )
          .bind(
            input.name,
            mutationToken,
            context.user.id,
            context.currentWorkspace.id,
            buildId,
            input.expectedVersion,
          )
      : db
          .prepare(
            `UPDATE builds
             SET status = 'archived',
                 record_version = record_version + 1,
                 mutation_token = ?1,
                 updated_by = ?2,
                 updated_at = CURRENT_TIMESTAMP
             WHERE workspace_id = ?3
               AND id = ?4
               AND status = 'draft'
               AND record_version = ?5`,
          )
          .bind(
            mutationToken,
            context.user.id,
            context.currentWorkspace.id,
            buildId,
            input.expectedVersion,
          );

  const statements: D1PreparedStatement[] = [updateStatement];
  if (input.action === "update") {
    statements.push(
      db
        .prepare(
          `DELETE FROM build_items
           WHERE workspace_id = ?1
             AND build_id = ?2
             AND EXISTS (
               SELECT 1
               FROM builds
               WHERE workspace_id = ?1
                 AND id = ?2
                 AND status = 'draft'
                 AND mutation_token = ?3
             )`,
        )
        .bind(context.currentWorkspace.id, buildId, mutationToken),
      ...selectedParts.map((part) =>
        guardedBuildItemInsert(
          db,
          context.currentWorkspace.id,
          buildId,
          mutationToken,
          part,
        ),
      ),
    );
  }
  statements.push(
    db
      .prepare(
        `INSERT INTO audit_events (
           id, workspace_id, user_id, action, target_type, target_id,
           request_id, metadata_json
         )
         SELECT ?1, workspace_id, ?2, ?3, 'build', id, ?4, ?5
         FROM builds
         WHERE workspace_id = ?6 AND id = ?7 AND mutation_token = ?8`,
      )
      .bind(
        crypto.randomUUID(),
        context.user.id,
        `build.${input.action}`,
        requestId,
        JSON.stringify({
          buildVersion: nextVersion,
          selectedCount:
            input.action === "update" ? selectedParts.length : undefined,
        }),
        context.currentWorkspace.id,
        buildId,
        mutationToken,
      ),
  );

  const [updateResult] = await db.batch(statements);
  if (updateResult?.meta.changes !== 1) {
    const existing = await findBuild(db, context.currentWorkspace.id, buildId);
    if (!existing) {
      throw buildNotFound();
    }
    throw buildVersionConflict();
  }

  if (input.action === "archive") {
    return new Response(null, {
      status: 204,
      headers: { "cache-control": "no-store" },
    });
  }
  return Response.json(
    buildRecordSchema.parse(
      await loadBuildRecord(db, context.currentWorkspace.id, buildId),
    ),
    { headers: { "cache-control": "no-store" } },
  );
}

export async function buildExportResponse(
  db: D1Database,
  context: RequestContext,
  buildId: string,
): Promise<Response> {
  validateBuildId(buildId);
  const build = await loadBuildRecord(db, context.currentWorkspace.id, buildId);
  if (!isBuildExportReady(build)) {
    throw new ApiError(
      409,
      "BUILD_EXPORT_BLOCKED",
      "解決嚴重錯誤及未知相容性結果後才可匯出組裝。",
    );
  }
  return new Response(
    `${JSON.stringify(portableBuildExport(build), null, 2)}\n`,
    {
      headers: {
        "cache-control": "private, no-store",
        "content-disposition": 'attachment; filename="rigstage-build.json"',
        "content-type": "application/json; charset=utf-8",
      },
    },
  );
}
