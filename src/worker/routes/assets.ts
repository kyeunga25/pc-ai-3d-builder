import {
  assetReviewCheckSchema,
  assetReviewChecks,
  assetReviewItemSchema,
  assetReviewMutationSchema,
  assetReviewQueueResponseSchema,
  type AssetReviewItem,
  type AssetReviewMutation,
} from "../../shared/domain/assets";
import type { WorkspaceRole } from "../../shared/domain/session";
import type { RequestContext } from "../auth/workspace";
import { ApiError } from "../lib/api-error";
import { readBoundedJson } from "../lib/request-body";

type AssetReviewRow = {
  asset_id: string;
  part_id: string;
  sku: string;
  manufacturer: string;
  model: string;
  status: string;
  quality: string;
  source_kind: string;
  completed_checks_json: string;
  source_rights_confirmed: number;
  verified_width_mm: number | null;
  verified_height_mm: number | null;
  verified_depth_mm: number | null;
  review_version: number;
};

type ReviewTransition = {
  status: AssetReviewItem["status"];
  quality: AssetReviewItem["quality"];
};

const recordIdPattern = /^[A-Za-z0-9_-]{1,128}$/u;

function roleError(): ApiError {
  return new ApiError(
    403,
    "ROLE_FORBIDDEN",
    "你目前的工作空間角色無權執行這項審核操作。",
  );
}

export function resolveReviewTransition(
  role: WorkspaceRole,
  input: AssetReviewMutation,
): ReviewTransition {
  if (role === "viewer") {
    throw roleError();
  }

  if (
    (input.action === "approve" || input.action === "reject") &&
    role !== "owner" &&
    role !== "admin"
  ) {
    throw roleError();
  }

  if (input.action === "approve") {
    const completed = new Set(input.completedChecks);
    const allChecksComplete = assetReviewChecks.every((check) =>
      completed.has(check),
    );
    const { width, height, depth } = input.dimensionsMm;

    if (
      !allChecksComplete ||
      width === null ||
      height === null ||
      depth === null
    ) {
      throw new ApiError(
        409,
        "ASSET_APPROVAL_INCOMPLETE",
        "所有核准項目及核實尺寸完成後才可核准素材。",
      );
    }

    return { status: "approved", quality: "approved" };
  }

  if (input.action === "reject") {
    return { status: "rejected", quality: "reviewed" };
  }

  return { status: "draft", quality: "draft" };
}

function parseCompletedChecks(value: string) {
  return assetReviewCheckSchema.array().parse(JSON.parse(value) as unknown);
}

function mapAssetReviewRow(row: AssetReviewRow): AssetReviewItem {
  return assetReviewItemSchema.parse({
    id: row.asset_id,
    part: {
      id: row.part_id,
      sku: row.sku,
      manufacturer: row.manufacturer,
      model: row.model,
    },
    status: row.status,
    quality: row.quality,
    sourceKind: row.source_kind,
    completedChecks: parseCompletedChecks(row.completed_checks_json),
    sourceRightsConfirmed: row.source_rights_confirmed === 1,
    dimensionsMm: {
      width: row.verified_width_mm,
      height: row.verified_height_mm,
      depth: row.verified_depth_mm,
    },
    version: row.review_version,
  });
}

const assetSelect = `SELECT a.id AS asset_id, p.id AS part_id, p.sku,
                            p.manufacturer, p.model, a.status, a.quality,
                            a.source_kind, a.completed_checks_json,
                            a.source_rights_confirmed, a.verified_width_mm,
                            a.verified_height_mm, a.verified_depth_mm,
                            a.review_version
                     FROM product_assets AS a
                     INNER JOIN catalog_parts AS p
                       ON p.workspace_id = a.workspace_id
                      AND p.id = a.catalog_part_id`;

async function findAsset(
  db: D1Database,
  workspaceId: string,
  assetId: string,
): Promise<AssetReviewRow | null> {
  return db
    .prepare(
      `${assetSelect}
       WHERE a.workspace_id = ?1 AND a.id = ?2 AND p.status = 'active'
       LIMIT 1`,
    )
    .bind(workspaceId, assetId)
    .first<AssetReviewRow>();
}

export async function assetReviewQueueResponse(
  db: D1Database,
  context: RequestContext,
): Promise<Response> {
  const result = await db
    .prepare(
      `${assetSelect}
       WHERE a.workspace_id = ?1
         AND a.status IN ('draft', 'in_review')
         AND p.status = 'active'
       ORDER BY a.updated_at, a.id
       LIMIT 50`,
    )
    .bind(context.currentWorkspace.id)
    .all<AssetReviewRow>();
  const body = assetReviewQueueResponseSchema.parse({
    items: result.results.map(mapAssetReviewRow),
  });

  return Response.json(body, {
    headers: { "cache-control": "no-store" },
  });
}

export async function assetReviewMutationResponse(
  request: Request,
  db: D1Database,
  context: RequestContext,
  assetId: string,
  requestId: string,
): Promise<Response> {
  if (!recordIdPattern.test(assetId)) {
    throw new ApiError(404, "ASSET_NOT_FOUND", "找不到所要求的素材。");
  }

  const parsed = assetReviewMutationSchema.safeParse(
    await readBoundedJson(request),
  );
  if (!parsed.success) {
    throw new ApiError(400, "VALIDATION_ERROR", "素材審核內容無效。");
  }

  const input = parsed.data;
  const transition = resolveReviewTransition(
    context.currentWorkspace.role,
    input,
  );
  const orderedChecks = assetReviewChecks.filter((check) =>
    input.completedChecks.includes(check),
  );
  const completedChecksJson = JSON.stringify(orderedChecks);
  const nextVersion = input.expectedVersion + 1;
  const sourceRightsConfirmed = orderedChecks.includes("source_rights") ? 1 : 0;
  const reviewEventId = crypto.randomUUID();
  const auditEventId = crypto.randomUUID();
  const auditMetadata = JSON.stringify({
    decision: input.action,
    reviewVersion: nextVersion,
  });

  const statements = [
    db
      .prepare(
        `UPDATE product_assets
         SET status = ?1,
             quality = ?2,
             completed_checks_json = ?3,
             source_rights_confirmed = ?4,
             verified_width_mm = ?5,
             verified_height_mm = ?6,
             verified_depth_mm = ?7,
             review_version = review_version + 1,
             updated_by = ?8,
             approved_by = CASE WHEN ?1 = 'approved' THEN ?8 ELSE NULL END,
             approved_at = CASE WHEN ?1 = 'approved' THEN CURRENT_TIMESTAMP ELSE NULL END,
             rejected_at = CASE WHEN ?1 = 'rejected' THEN CURRENT_TIMESTAMP ELSE NULL END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?9
           AND workspace_id = ?10
           AND review_version = ?11
           AND status <> 'approved'`,
      )
      .bind(
        transition.status,
        transition.quality,
        completedChecksJson,
        sourceRightsConfirmed,
        input.dimensionsMm.width,
        input.dimensionsMm.height,
        input.dimensionsMm.depth,
        context.user.id,
        assetId,
        context.currentWorkspace.id,
        input.expectedVersion,
      ),
    db
      .prepare(
        `INSERT INTO asset_review_events (
           id, workspace_id, asset_id, reviewer_user_id, decision,
           review_version, completed_checks_json, verified_width_mm,
           verified_height_mm, verified_depth_mm
         )
         SELECT ?1, workspace_id, id, ?2, ?3, ?4, ?5, ?6, ?7, ?8
         FROM product_assets
         WHERE id = ?9 AND workspace_id = ?10 AND review_version = ?4`,
      )
      .bind(
        reviewEventId,
        context.user.id,
        input.action,
        nextVersion,
        completedChecksJson,
        input.dimensionsMm.width,
        input.dimensionsMm.height,
        input.dimensionsMm.depth,
        assetId,
        context.currentWorkspace.id,
      ),
    db
      .prepare(
        `INSERT INTO audit_events (
           id, workspace_id, user_id, action, target_type, target_id,
           request_id, metadata_json
         )
         SELECT ?1, workspace_id, ?2, ?3, 'product_asset', id, ?4, ?5
         FROM product_assets
         WHERE id = ?6 AND workspace_id = ?7 AND review_version = ?8`,
      )
      .bind(
        auditEventId,
        context.user.id,
        `asset.review.${input.action}`,
        requestId,
        auditMetadata,
        assetId,
        context.currentWorkspace.id,
        nextVersion,
      ),
  ];

  const [updateResult] = await db.batch(statements);
  if (updateResult?.meta.changes !== 1) {
    const existing = await findAsset(db, context.currentWorkspace.id, assetId);
    if (!existing) {
      throw new ApiError(404, "ASSET_NOT_FOUND", "找不到所要求的素材。");
    }

    throw new ApiError(
      409,
      "ASSET_VERSION_CONFLICT",
      "素材已由另一個審核動作更新，請重新載入後再試。",
    );
  }

  const updated = await findAsset(db, context.currentWorkspace.id, assetId);
  if (!updated) {
    throw new Error("Updated asset could not be read.");
  }

  return Response.json(mapAssetReviewRow(updated), {
    headers: { "cache-control": "no-store" },
  });
}
