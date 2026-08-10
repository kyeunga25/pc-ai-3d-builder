import {
  catalogueImportResponseSchema,
  catalogueMutationSchema,
  cataloguePartInputSchema,
  type CataloguePartInput,
} from "../../shared/domain/schemas";
import {
  CatalogueCsvError,
  parseCatalogueCsvFile,
} from "../../shared/domain/catalogue-csv";
import type { WorkspaceRole } from "../../shared/domain/session";
import { cataloguePartTargetHeader } from "../../shared/lib/catalogue-target";
import type { RequestContext } from "../auth/workspace";
import { ApiError } from "../lib/api-error";
import { readBoundedCsv, readBoundedJson } from "../lib/request-body";
import {
  catalogueRecordIdPattern,
  catalogueSelect,
  findCataloguePart,
  mapCatalogueRow,
  type CatalogueRow,
} from "./catalogue";

function roleError(): ApiError {
  return new ApiError(
    403,
    "ROLE_FORBIDDEN",
    "你目前的工作空間角色無權修改產品目錄。 / Your current workspace role cannot modify the catalogue.",
  );
}

function assertCatalogueWriteRole(role: WorkspaceRole): void {
  if (role === "viewer") {
    throw roleError();
  }
}

function validationError(
  message = "產品目錄內容無效。 / The catalogue data is invalid.",
): ApiError {
  return new ApiError(400, "VALIDATION_ERROR", message);
}

function skuConflict(): ApiError {
  return new ApiError(
    409,
    "CATALOGUE_SKU_CONFLICT",
    "同一工作空間內已經存在相同 SKU。 / The same SKU already exists in this workspace.",
  );
}

function versionConflict(): ApiError {
  return new ApiError(
    409,
    "CATALOGUE_VERSION_CONFLICT",
    "產品已由另一個操作更新，請重新載入後再試。 / The product changed in another operation. Reload and try again.",
  );
}

function categoryLocked(): ApiError {
  return new ApiError(
    409,
    "CATALOGUE_CATEGORY_LOCKED",
    "此產品已被組裝引用，不能更改類別；請保留原類別或建立新產品。 / This part is used by a build, so its category cannot be changed. Keep the current category or create a new part.",
  );
}

function generationLocked(): ApiError {
  return new ApiError(
    409,
    "CATALOGUE_GENERATION_LOCKED",
    "此產品有保留 credit 的生成工作；請等待工作完成，並由 owner 或 admin 核准或拒絕草稿後再封存。 / This part has a generation job with reserved credit. Wait for it to finish, then ask an owner or admin to approve or reject the draft before archiving.",
  );
}

function notFound(): ApiError {
  return new ApiError(
    404,
    "CATALOGUE_PART_NOT_FOUND",
    "找不到所要求的產品。 / The requested catalogue part was not found.",
  );
}

function cataloguePartId(): string {
  return `part_${crypto.randomUUID()}`;
}

function catalogueAuditMetadata(
  input: CataloguePartInput,
  recordVersion: number,
): string {
  return JSON.stringify({
    category: input.category,
    recordVersion,
  });
}

function insertStatement(
  db: D1Database,
  context: RequestContext,
  partId: string,
  input: CataloguePartInput,
) {
  return db
    .prepare(
      `INSERT INTO catalog_parts (
         id, workspace_id, sku, category, manufacturer, model, price_minor,
         stock_status, stock_count, specifications_json,
         specification_status, created_by, updated_by
       )
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?12)`,
    )
    .bind(
      partId,
      context.currentWorkspace.id,
      input.sku,
      input.category,
      input.manufacturer,
      input.model,
      input.priceMinor,
      input.stockStatus,
      input.stockCount,
      JSON.stringify(input.specifications),
      input.specificationStatus,
      context.user.id,
    );
}

function auditInsertStatement(
  db: D1Database,
  context: RequestContext,
  requestId: string,
  partId: string,
  action: string,
  metadataJson: string,
  expectedRecordVersion: number,
) {
  return db
    .prepare(
      `INSERT INTO audit_events (
         id, workspace_id, user_id, action, target_type, target_id,
         request_id, metadata_json
       )
       SELECT ?1, workspace_id, ?2, ?3, 'catalog_part', id, ?4, ?5
       FROM catalog_parts
       WHERE id = ?6
         AND workspace_id = ?7
         AND record_version = ?8
         AND changes() = 1`,
    )
    .bind(
      crypto.randomUUID(),
      context.user.id,
      action,
      requestId,
      metadataJson,
      partId,
      context.currentWorkspace.id,
      expectedRecordVersion,
    );
}

async function findSku(
  db: D1Database,
  workspaceId: string,
  sku: string,
  excludingPartId?: string,
): Promise<{ id: string } | null> {
  const excludingClause = excludingPartId ? "AND id <> ?3" : "";
  return db
    .prepare(
      `SELECT id
       FROM catalog_parts
       WHERE workspace_id = ?1
         AND sku = ?2
         AND status = 'active'
         ${excludingClause}
       LIMIT 1`,
    )
    .bind(
      ...([workspaceId, sku, excludingPartId].filter(
        (value) => value !== undefined,
      ) as string[]),
    )
    .first<{ id: string }>();
}

async function hasReservedGeneration(
  db: D1Database,
  workspaceId: string,
  partId: string,
): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT 1 AS reserved
       FROM product_assets AS a
       INNER JOIN generation_jobs AS j
         ON j.workspace_id = a.workspace_id AND j.asset_id = a.id
       INNER JOIN generation_job_entitlements AS e
         ON e.workspace_id = j.workspace_id AND e.job_id = j.id
       WHERE a.workspace_id = ?1 AND a.catalog_part_id = ?2
         AND e.status = 'reserved'
       LIMIT 1`,
    )
    .bind(workspaceId, partId)
    .first<{ reserved: number }>();
  return row !== null;
}

export async function catalogueCreateResponse(
  request: Request,
  db: D1Database,
  context: RequestContext,
  requestId: string,
): Promise<Response> {
  assertCatalogueWriteRole(context.currentWorkspace.role);
  const parsed = cataloguePartInputSchema.safeParse(
    await readBoundedJson(request),
  );
  if (!parsed.success) {
    throw validationError();
  }

  const input = parsed.data;
  if (await findSku(db, context.currentWorkspace.id, input.sku)) {
    throw skuConflict();
  }

  const partId = cataloguePartId();

  try {
    await db.batch([
      insertStatement(db, context, partId, input),
      auditInsertStatement(
        db,
        context,
        requestId,
        partId,
        "catalogue.part.create",
        catalogueAuditMetadata(input, 0),
        0,
      ),
    ]);
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE")) {
      throw skuConflict();
    }
    throw error;
  }

  const created = await findCataloguePart(
    db,
    context.currentWorkspace.id,
    partId,
  );
  if (!created) {
    throw new Error("Created catalogue part could not be read.");
  }

  return Response.json(mapCatalogueRow(created), {
    status: 201,
    headers: { "cache-control": "no-store" },
  });
}

export async function catalogueMutationResponse(
  request: Request,
  db: D1Database,
  context: RequestContext,
  requestId: string,
): Promise<Response> {
  assertCatalogueWriteRole(context.currentWorkspace.role);
  const partId = request.headers.get(cataloguePartTargetHeader);
  if (!partId || !catalogueRecordIdPattern.test(partId)) {
    throw notFound();
  }

  const parsed = catalogueMutationSchema.safeParse(
    await readBoundedJson(request),
  );
  if (!parsed.success) {
    throw validationError();
  }

  const input = parsed.data;
  const nextVersion = input.expectedVersion + 1;

  if (input.action === "archive") {
    let archiveResult: D1Result<unknown> | undefined;
    try {
      [archiveResult] = await db.batch([
        db
          .prepare(
            `UPDATE catalog_parts
             SET status = 'archived',
                 record_version = record_version + 1,
                 updated_by = ?1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?2
               AND workspace_id = ?3
               AND record_version = ?4
               AND status = 'active'
               AND NOT EXISTS (
                 SELECT 1
                 FROM product_assets AS a
                 INNER JOIN generation_jobs AS j
                   ON j.workspace_id = a.workspace_id
                  AND j.asset_id = a.id
                 INNER JOIN generation_job_entitlements AS e
                   ON e.workspace_id = j.workspace_id
                  AND e.job_id = j.id
                 WHERE a.workspace_id = catalog_parts.workspace_id
                   AND a.catalog_part_id = catalog_parts.id
                   AND e.status = 'reserved'
               )`,
          )
          .bind(
            context.user.id,
            partId,
            context.currentWorkspace.id,
            input.expectedVersion,
          ),
        auditInsertStatement(
          db,
          context,
          requestId,
          partId,
          "catalogue.part.archive",
          JSON.stringify({ recordVersion: nextVersion }),
          nextVersion,
        ),
      ]);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("CATALOGUE_GENERATION_RESERVED")
      ) {
        throw generationLocked();
      }
      throw error;
    }

    if (archiveResult?.meta.changes !== 1) {
      const existing = await findCataloguePart(
        db,
        context.currentWorkspace.id,
        partId,
      );
      if (!existing) {
        throw notFound();
      }
      if (existing.record_version !== input.expectedVersion) {
        throw versionConflict();
      }
      if (
        await hasReservedGeneration(db, context.currentWorkspace.id, partId)
      ) {
        throw generationLocked();
      }
      throw versionConflict();
    }

    return new Response(null, {
      status: 204,
      headers: { "cache-control": "no-store" },
    });
  }

  if (await findSku(db, context.currentWorkspace.id, input.sku, partId)) {
    throw skuConflict();
  }

  let updateResult: D1Result<unknown> | undefined;
  try {
    [updateResult] = await db.batch([
      db
        .prepare(
          `UPDATE catalog_parts
           SET sku = ?1,
               category = ?2,
               manufacturer = ?3,
               model = ?4,
               price_minor = ?5,
               stock_status = ?6,
               stock_count = ?7,
               specifications_json = ?8,
               specification_status = ?9,
               record_version = record_version + 1,
               updated_by = ?10,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?11
             AND workspace_id = ?12
             AND record_version = ?13
             AND status = 'active'`,
        )
        .bind(
          input.sku,
          input.category,
          input.manufacturer,
          input.model,
          input.priceMinor,
          input.stockStatus,
          input.stockCount,
          JSON.stringify(input.specifications),
          input.specificationStatus,
          context.user.id,
          partId,
          context.currentWorkspace.id,
          input.expectedVersion,
        ),
      auditInsertStatement(
        db,
        context,
        requestId,
        partId,
        "catalogue.part.update",
        catalogueAuditMetadata(input, nextVersion),
        nextVersion,
      ),
    ]);
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE")) {
      throw skuConflict();
    }
    if (error instanceof Error && error.message.includes("FOREIGN KEY")) {
      throw categoryLocked();
    }
    throw error;
  }

  if (updateResult?.meta.changes !== 1) {
    const existing = await findCataloguePart(
      db,
      context.currentWorkspace.id,
      partId,
    );
    if (!existing) {
      throw notFound();
    }
    throw versionConflict();
  }

  const updated = await findCataloguePart(
    db,
    context.currentWorkspace.id,
    partId,
  );
  if (!updated) {
    throw new Error("Updated catalogue part could not be read.");
  }

  return Response.json(mapCatalogueRow(updated), {
    headers: { "cache-control": "no-store" },
  });
}

export function parseCatalogueCsv(text: string): CataloguePartInput[] {
  try {
    return parseCatalogueCsvFile(text);
  } catch (error) {
    if (error instanceof CatalogueCsvError) {
      if (error.kind === "sku_conflict") {
        throw skuConflict();
      }
      throw validationError(error.message);
    }
    throw error;
  }
}

async function findExistingImportedSku(
  db: D1Database,
  workspaceId: string,
  inputs: CataloguePartInput[],
): Promise<boolean> {
  const placeholders = inputs.map((_, index) => `?${index + 2}`).join(", ");
  const existing = await db
    .prepare(
      `SELECT id
       FROM catalog_parts
       WHERE workspace_id = ?1
         AND status = 'active'
         AND sku IN (${placeholders})
       LIMIT 1`,
    )
    .bind(workspaceId, ...inputs.map((input) => input.sku))
    .first<{ id: string }>();
  return existing !== null;
}

export async function catalogueImportResponse(
  request: Request,
  db: D1Database,
  context: RequestContext,
  requestId: string,
): Promise<Response> {
  assertCatalogueWriteRole(context.currentWorkspace.role);
  const inputs = parseCatalogueCsv(await readBoundedCsv(request));
  if (await findExistingImportedSku(db, context.currentWorkspace.id, inputs)) {
    throw skuConflict();
  }

  const records = inputs.map((input) => ({
    id: cataloguePartId(),
    input,
  }));
  const statements = records.flatMap(({ id, input }) => [
    insertStatement(db, context, id, input),
    auditInsertStatement(
      db,
      context,
      requestId,
      id,
      "catalogue.part.import",
      catalogueAuditMetadata(input, 0),
      0,
    ),
  ]);

  try {
    await db.batch(statements);
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE")) {
      throw skuConflict();
    }
    throw error;
  }

  const placeholders = records.map((_, index) => `?${index + 2}`).join(", ");
  const result = await db
    .prepare(
      `${catalogueSelect}
       WHERE p.workspace_id = ?1
         AND p.status = 'active'
         AND p.id IN (${placeholders})
       ORDER BY p.id`,
    )
    .bind(context.currentWorkspace.id, ...records.map((record) => record.id))
    .all<CatalogueRow>();
  const body = catalogueImportResponseSchema.parse({
    created: result.results.map(mapCatalogueRow),
  });

  return Response.json(body, {
    status: 201,
    headers: { "cache-control": "no-store" },
  });
}
