import {
  AssetFileValidationError,
  assetFileKindSchema,
  assetFileLimits,
  validateAssetFileBytes,
  type AssetFileKind,
} from "../../shared/domain/asset-files";
import type { WorkspaceRole } from "../../shared/domain/session";
import {
  assetFileKindHeader,
  assetTargetHeader,
} from "../../shared/lib/asset-target";
import { cataloguePartTargetHeader } from "../../shared/lib/catalogue-target";
import type { RequestContext } from "../auth/workspace";
import {
  findReservedGenerationForAsset,
  generationSupersededAccountingStatements,
} from "../generation/accounting";
import { ApiError } from "../lib/api-error";
import { sha256Hex } from "../lib/digest";
import {
  assetObjectKey,
  deletePrivateObjectQuietly,
  getVerifiedPrivateObject,
  putPrivateObject,
} from "../lib/private-assets";
import { readBoundedBinary } from "../lib/request-body";
import { assetRecordIdPattern, findAsset, mapAssetReviewRow } from "./assets";
import { catalogueRecordIdPattern } from "./catalogue";

type CataloguePartIdentity = {
  id: string;
};

type ValidatedAssetFile = {
  bytes: Uint8Array;
  contentType: string;
  sha256: string;
};

function writeRoleError(): ApiError {
  return new ApiError(
    403,
    "ROLE_FORBIDDEN",
    "你目前的工作空間角色無權上載私人素材。 / Your current workspace role cannot upload private asset files.",
  );
}

function assertWriteRole(role: WorkspaceRole): void {
  if (role === "viewer") {
    throw writeRoleError();
  }
}

function validationError(
  message = "素材上載內容無效。 / The asset upload is invalid.",
): ApiError {
  return new ApiError(400, "VALIDATION_ERROR", message);
}

function assetNotFound(): ApiError {
  return new ApiError(
    404,
    "ASSET_NOT_FOUND",
    "找不到所要求的素材。 / The requested asset was not found.",
  );
}

function cataloguePartNotFound(): ApiError {
  return new ApiError(
    404,
    "CATALOGUE_PART_NOT_FOUND",
    "找不到可建立素材的有效產品。 / No active product was found for this asset.",
  );
}

function assetFileNotFound(): ApiError {
  return new ApiError(
    404,
    "ASSET_FILE_NOT_FOUND",
    "找不到可安全讀取的素材檔案，請重新上載後再試。 / No safely readable asset file was found. Upload it again and retry.",
  );
}

function assetVersionConflict(): ApiError {
  return new ApiError(
    409,
    "ASSET_VERSION_CONFLICT",
    "素材已由另一個操作更新，請重新載入後再試。 / The asset changed in another operation. Reload and retry.",
  );
}

function normalizedContentType(request: Request): string {
  return (
    request.headers
      .get("content-type")
      ?.split(";", 1)[0]
      ?.trim()
      .toLowerCase() ?? ""
  );
}

async function readValidatedFile(
  request: Request,
  kind: AssetFileKind,
): Promise<ValidatedAssetFile> {
  const bytes = await readBoundedBinary(request, assetFileLimits[kind]);
  try {
    const contentType = validateAssetFileBytes(
      kind,
      normalizedContentType(request),
      bytes,
    );
    return {
      bytes,
      contentType,
      sha256: await sha256Hex(bytes),
    };
  } catch (error) {
    if (error instanceof AssetFileValidationError) {
      throw validationError(error.message);
    }
    throw error;
  }
}

function uploadAuditMetadata(
  kind: AssetFileKind,
  sizeBytes: number,
  reviewVersion: number,
): string {
  return JSON.stringify({ kind, sizeBytes, reviewVersion });
}

export async function createAssetSourceResponse(
  request: Request,
  db: D1Database,
  bucket: R2Bucket,
  context: RequestContext,
  requestId: string,
): Promise<Response> {
  assertWriteRole(context.currentWorkspace.role);
  const partId = request.headers.get(cataloguePartTargetHeader);
  if (!partId || !catalogueRecordIdPattern.test(partId)) {
    throw cataloguePartNotFound();
  }

  const part = await db
    .prepare(
      `SELECT id
       FROM catalog_parts
       WHERE id = ?1 AND workspace_id = ?2 AND status = 'active'
       LIMIT 1`,
    )
    .bind(partId, context.currentWorkspace.id)
    .first<CataloguePartIdentity>();
  if (!part) {
    throw cataloguePartNotFound();
  }

  const existing = await db
    .prepare(
      `SELECT id
       FROM product_assets
       WHERE workspace_id = ?1 AND catalog_part_id = ?2
       LIMIT 1`,
    )
    .bind(context.currentWorkspace.id, partId)
    .first<{ id: string }>();
  if (existing) {
    throw new ApiError(
      409,
      "ASSET_ALREADY_EXISTS",
      "此產品已經有素材記錄，請前往素材審核更新檔案。",
    );
  }

  const file = await readValidatedFile(request, "source");
  const assetId = `asset_${crypto.randomUUID()}`;
  const objectKey = assetObjectKey(
    context.currentWorkspace.id,
    assetId,
    "source",
  );
  await putPrivateObject(
    bucket,
    objectKey,
    file.bytes,
    file.contentType,
    file.sha256,
  );

  try {
    await db.batch([
      db
        .prepare(
          `INSERT INTO product_assets (
             id, workspace_id, catalog_part_id, status, quality, source_kind,
             source_object_key, source_content_type, source_size_bytes,
             source_sha256, created_by, updated_by
           )
           VALUES (
             ?1, ?2, ?3, 'draft', 'unreviewed', 'uploaded',
             ?4, ?5, ?6, ?7, ?8, ?8
           )`,
        )
        .bind(
          assetId,
          context.currentWorkspace.id,
          partId,
          objectKey,
          file.contentType,
          file.bytes.byteLength,
          file.sha256,
          context.user.id,
        ),
      db
        .prepare(
          `INSERT INTO audit_events (
             id, workspace_id, user_id, action, target_type, target_id,
             request_id, metadata_json
           )
           SELECT ?1, workspace_id, ?2, 'asset.file.source.create',
                  'product_asset', id, ?3, ?4
           FROM product_assets
           WHERE id = ?5 AND workspace_id = ?6 AND changes() = 1`,
        )
        .bind(
          crypto.randomUUID(),
          context.user.id,
          requestId,
          uploadAuditMetadata("source", file.bytes.byteLength, 0),
          assetId,
          context.currentWorkspace.id,
        ),
    ]);
  } catch (error) {
    await deletePrivateObjectQuietly(bucket, objectKey);
    if (
      error instanceof Error &&
      error.message.includes("ASSET_CATALOGUE_INACTIVE")
    ) {
      throw cataloguePartNotFound();
    }
    if (error instanceof Error && error.message.includes("UNIQUE")) {
      throw new ApiError(
        409,
        "ASSET_ALREADY_EXISTS",
        "此產品已經有素材記錄，請前往素材審核更新檔案。",
      );
    }
    throw error;
  }

  const created = await findAsset(db, context.currentWorkspace.id, assetId);
  if (!created) {
    throw new Error("Created asset could not be read.");
  }

  return Response.json(mapAssetReviewRow(created), {
    status: 201,
    headers: { "cache-control": "no-store" },
  });
}

function expectedVersion(request: Request): number {
  const rawVersion = request.headers.get("x-rigstage-expected-version");
  if (!rawVersion || !/^\d{1,10}$/u.test(rawVersion)) {
    throw validationError(
      "素材上載必須包含有效的目前版本。 / The upload must include a valid current asset version.",
    );
  }
  const version = Number(rawVersion);
  if (!Number.isSafeInteger(version)) {
    throw validationError(
      "素材上載版本無效。 / The asset upload version is invalid.",
    );
  }
  return version;
}

export async function assetFileUploadResponse(
  request: Request,
  db: D1Database,
  bucket: R2Bucket,
  context: RequestContext,
  requestId: string,
): Promise<Response> {
  assertWriteRole(context.currentWorkspace.role);
  const assetId = request.headers.get(assetTargetHeader);
  const rawKind = request.headers.get(assetFileKindHeader);
  const kindResult = assetFileKindSchema.safeParse(rawKind);
  if (!assetId || !assetRecordIdPattern.test(assetId) || !kindResult.success) {
    throw assetNotFound();
  }
  const kind = kindResult.data;
  const current = await findAsset(db, context.currentWorkspace.id, assetId);
  if (!current) {
    throw assetNotFound();
  }
  if (current.status === "approved") {
    throw new ApiError(
      409,
      "ASSET_LOCKED",
      "已核准素材不可直接取代。 / An approved asset cannot be replaced directly.",
    );
  }

  const currentVersion = expectedVersion(request);
  if (current.review_version !== currentVersion) {
    throw assetVersionConflict();
  }

  const file = await readValidatedFile(request, kind);
  const objectKey = assetObjectKey(context.currentWorkspace.id, assetId, kind);
  const previousObjectKey =
    kind === "source" ? current.source_object_key : current.model_object_key;
  const reservedGeneration =
    current.source_kind === "generated"
      ? await findReservedGenerationForAsset(
          db,
          context.currentWorkspace.id,
          assetId,
          current.model_object_key,
        )
      : null;
  const nextVersion = currentVersion + 1;
  await putPrivateObject(
    bucket,
    objectKey,
    file.bytes,
    file.contentType,
    file.sha256,
  );

  const updateStatement =
    kind === "source"
      ? db
          .prepare(
            `UPDATE product_assets
             SET source_kind = 'uploaded',
                 source_object_key = ?1,
                 source_content_type = ?2,
                 source_size_bytes = ?3,
                 source_sha256 = ?4,
                 status = 'draft',
                 quality = 'unreviewed',
                 completed_checks_json = '[]',
                 source_rights_confirmed = 0,
                 verified_width_mm = NULL,
                 verified_height_mm = NULL,
                 verified_depth_mm = NULL,
                 review_version = review_version + 1,
                 updated_by = ?5,
                 approved_by = NULL,
                 approved_at = NULL,
                 rejected_at = NULL,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?6
               AND workspace_id = ?7
               AND review_version = ?8
               AND status <> 'approved'`,
          )
          .bind(
            objectKey,
            file.contentType,
            file.bytes.byteLength,
            file.sha256,
            context.user.id,
            assetId,
            context.currentWorkspace.id,
            currentVersion,
          )
      : db
          .prepare(
            `UPDATE product_assets
             SET source_kind = 'uploaded',
                 model_object_key = ?1,
                 model_content_type = ?2,
                 model_size_bytes = ?3,
                 model_sha256 = ?4,
                 status = 'draft',
                 quality = 'unreviewed',
                 completed_checks_json = '[]',
                 source_rights_confirmed = 0,
                 verified_width_mm = NULL,
                 verified_height_mm = NULL,
                 verified_depth_mm = NULL,
                 review_version = review_version + 1,
                 updated_by = ?5,
                 approved_by = NULL,
                 approved_at = NULL,
                 rejected_at = NULL,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?6
               AND workspace_id = ?7
               AND review_version = ?8
               AND status <> 'approved'`,
          )
          .bind(
            objectKey,
            file.contentType,
            file.bytes.byteLength,
            file.sha256,
            context.user.id,
            assetId,
            context.currentWorkspace.id,
            currentVersion,
          );

  let updateResult: D1Result<unknown> | undefined;
  try {
    const statements = [
      updateStatement,
      db
        .prepare(
          `INSERT INTO audit_events (
             id, workspace_id, user_id, action, target_type, target_id,
             request_id, metadata_json
           )
           SELECT ?1, workspace_id, ?2, ?3, 'product_asset', id, ?4, ?5
           FROM product_assets
           WHERE id = ?6
             AND workspace_id = ?7
             AND review_version = ?8
             AND changes() = 1`,
        )
        .bind(
          crypto.randomUUID(),
          context.user.id,
          `asset.file.${kind}.upload`,
          requestId,
          uploadAuditMetadata(kind, file.bytes.byteLength, nextVersion),
          assetId,
          context.currentWorkspace.id,
          nextVersion,
        ),
    ];
    if (reservedGeneration) {
      statements.push(
        ...generationSupersededAccountingStatements(db, {
          workspaceId: context.currentWorkspace.id,
          jobId: reservedGeneration.jobId,
        }),
      );
    }
    [updateResult] = await db.batch(statements);
  } catch (error) {
    await deletePrivateObjectQuietly(bucket, objectKey);
    if (
      error instanceof Error &&
      error.message.includes("ASSET_CATALOGUE_INACTIVE")
    ) {
      throw assetNotFound();
    }
    throw error;
  }

  if (updateResult?.meta.changes !== 1) {
    await deletePrivateObjectQuietly(bucket, objectKey);
    const existing = await findAsset(db, context.currentWorkspace.id, assetId);
    if (!existing) {
      throw assetNotFound();
    }
    throw assetVersionConflict();
  }

  await deletePrivateObjectQuietly(bucket, previousObjectKey);
  const updated = await findAsset(db, context.currentWorkspace.id, assetId);
  if (!updated) {
    throw new Error("Uploaded asset could not be read.");
  }

  return Response.json(mapAssetReviewRow(updated), {
    headers: { "cache-control": "no-store" },
  });
}

function fileExtension(kind: AssetFileKind, contentType: string): string {
  if (kind === "model") {
    return "glb";
  }
  if (contentType === "image/png") {
    return "png";
  }
  if (contentType === "image/webp") {
    return "webp";
  }
  return "jpg";
}

export async function assetFileResponse(
  request: Request,
  db: D1Database,
  bucket: R2Bucket,
  context: RequestContext,
): Promise<Response> {
  const assetId = request.headers.get(assetTargetHeader);
  const rawKind = request.headers.get(assetFileKindHeader);
  const kindResult = assetFileKindSchema.safeParse(rawKind);
  if (!assetId || !assetRecordIdPattern.test(assetId) || !kindResult.success) {
    throw assetFileNotFound();
  }
  const kind = kindResult.data;
  const asset = await findAsset(db, context.currentWorkspace.id, assetId);
  if (!asset) {
    throw assetNotFound();
  }

  const objectKey =
    kind === "source" ? asset.source_object_key : asset.model_object_key;
  const contentType =
    kind === "source" ? asset.source_content_type : asset.model_content_type;
  const sizeBytes =
    kind === "source" ? asset.source_size_bytes : asset.model_size_bytes;
  const sha256 = kind === "source" ? asset.source_sha256 : asset.model_sha256;
  if (!objectKey || !contentType || sizeBytes === null || !sha256) {
    throw assetFileNotFound();
  }

  const object = await getVerifiedPrivateObject(
    bucket,
    objectKey,
    kind,
    contentType,
    sizeBytes,
    sha256,
  );
  if (!object) {
    throw assetFileNotFound();
  }

  return new Response(object.body, {
    headers: {
      "cache-control": "private, no-store",
      "content-disposition": `inline; filename="${kind}.${fileExtension(kind, contentType)}"`,
      "content-length": String(object.sizeBytes),
      "content-type": contentType,
    },
  });
}
