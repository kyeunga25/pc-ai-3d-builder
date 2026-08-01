import {
  generationJobListResponseSchema,
  generationJobSchema,
  generationJobStartInputSchema,
  type AssetGenerationParams,
  type GenerationCapability,
  type GenerationJob,
} from "../../shared/domain/generation-jobs";
import type { WorkspaceRole } from "../../shared/domain/session";
import type { RequestContext } from "../auth/workspace";
import { generationRuntimeConfig } from "../generation/provider";
import { ApiError } from "../lib/api-error";
import { readBoundedJson } from "../lib/request-body";
import { assetRecordIdPattern, findAsset } from "./assets";

type GenerationJobRow = {
  id: string;
  asset_id: string;
  status: string;
  execution_mode: string;
  workflow_instance_id: string;
  requested_review_version: number;
  output_object_key: string | null;
  failure_code: string | null;
  created_at: string;
  updated_at: string;
};

type GenerationRouteEnv = {
  ASSET_GENERATION: Workflow<AssetGenerationParams>;
  DB: D1Database;
  GENERATION_MAX_COST_MINOR: string;
  GENERATION_MODE: string;
};

const idempotencyKeyPattern = /^[A-Za-z0-9._:-]{8,128}$/u;

function generationRoleError(): ApiError {
  return new ApiError(
    403,
    "ROLE_FORBIDDEN",
    "只有工作空間 owner 或 admin 可建立生成工作。",
  );
}

function assertGenerationRole(role: WorkspaceRole): void {
  if (role !== "owner" && role !== "admin") {
    throw generationRoleError();
  }
}

function assetNotFound(): ApiError {
  return new ApiError(404, "ASSET_NOT_FOUND", "找不到所要求的素材。");
}

function mapGenerationJob(row: GenerationJobRow): GenerationJob {
  return generationJobSchema.parse({
    id: row.id,
    assetId: row.asset_id,
    status: row.status,
    kind: row.execution_mode,
    outputReady: row.output_object_key !== null,
    failureCode: row.failure_code,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function capability(env: GenerationRouteEnv): GenerationCapability {
  return generationRuntimeConfig(env);
}

async function findGenerationJob(
  db: D1Database,
  workspaceId: string,
  clause: "id" | "idempotency_key",
  value: string,
): Promise<GenerationJobRow | null> {
  return db
    .prepare(
      `SELECT id, asset_id, status, execution_mode, workflow_instance_id,
              requested_review_version, output_object_key, failure_code,
              created_at, updated_at
       FROM generation_jobs
       WHERE workspace_id = ?1 AND ${clause} = ?2
       LIMIT 1`,
    )
    .bind(workspaceId, value)
    .first<GenerationJobRow>();
}

async function findActiveGenerationJob(
  db: D1Database,
  workspaceId: string,
  assetId: string,
): Promise<GenerationJobRow | null> {
  return db
    .prepare(
      `SELECT id, asset_id, status, execution_mode, workflow_instance_id,
              requested_review_version, output_object_key, failure_code,
              created_at, updated_at
       FROM generation_jobs
       WHERE workspace_id = ?1
         AND asset_id = ?2
         AND status IN ('queued', 'running', 'validating')
       ORDER BY created_at DESC, id DESC
       LIMIT 1`,
    )
    .bind(workspaceId, assetId)
    .first<GenerationJobRow>();
}

async function markStartFailure(
  db: D1Database,
  workspaceId: string,
  jobId: string,
  requestId: string,
): Promise<void> {
  const failureCode = "GENERATION_START_FAILED";
  await db.batch([
    db
      .prepare(
        `UPDATE generation_jobs
         SET status = 'failed', failure_code = ?1,
             updated_at = CURRENT_TIMESTAMP, completed_at = CURRENT_TIMESTAMP
         WHERE workspace_id = ?2 AND id = ?3 AND status = 'queued'`,
      )
      .bind(failureCode, workspaceId, jobId),
    db
      .prepare(
        `INSERT INTO generation_job_events (
           id, workspace_id, job_id, status, event_type, failure_code
         )
         SELECT ?1, workspace_id, id, 'failed', 'start_failed', ?2
         FROM generation_jobs
         WHERE workspace_id = ?3 AND id = ?4
           AND status = 'failed' AND failure_code = ?2 AND changes() = 1`,
      )
      .bind(crypto.randomUUID(), failureCode, workspaceId, jobId),
    db
      .prepare(
        `INSERT INTO audit_events (
           id, workspace_id, user_id, action, target_type, target_id,
           request_id, metadata_json
         )
         SELECT ?1, workspace_id, requested_by, 'generation.start.failed',
                'generation_job', id, ?2, ?3
         FROM generation_jobs
         WHERE workspace_id = ?4 AND id = ?5
           AND status = 'failed' AND failure_code = ?6 AND changes() = 1`,
      )
      .bind(
        crypto.randomUUID(),
        requestId,
        JSON.stringify({ failureCode }),
        workspaceId,
        jobId,
        failureCode,
      ),
  ]);
}

async function ensureWorkflowStarted(
  workflow: Workflow<AssetGenerationParams>,
  row: GenerationJobRow,
  params: AssetGenerationParams,
  isNew: boolean,
): Promise<void> {
  if (!isNew) {
    const instance = await workflow.get(row.workflow_instance_id);
    const state = await instance.status();
    if (state.status !== "unknown") {
      return;
    }
  }
  await workflow.create({ id: row.workflow_instance_id, params });
}

export async function generationJobListResponse(
  env: GenerationRouteEnv,
  context: RequestContext,
  assetId: string,
): Promise<Response> {
  if (!assetRecordIdPattern.test(assetId)) {
    throw assetNotFound();
  }
  const asset = await findAsset(env.DB, context.currentWorkspace.id, assetId);
  if (!asset) {
    throw assetNotFound();
  }
  const result = await env.DB.prepare(
    `SELECT id, asset_id, status, execution_mode, workflow_instance_id,
              requested_review_version, output_object_key, failure_code,
              created_at, updated_at
       FROM generation_jobs
       WHERE workspace_id = ?1 AND asset_id = ?2
       ORDER BY created_at DESC, id DESC
       LIMIT 20`,
  )
    .bind(context.currentWorkspace.id, assetId)
    .all<GenerationJobRow>();
  const body = generationJobListResponseSchema.parse({
    capability: capability(env),
    items: result.results.map(mapGenerationJob),
  });
  return Response.json(body, {
    headers: { "cache-control": "no-store" },
  });
}

export async function generationJobStartResponse(
  request: Request,
  env: GenerationRouteEnv,
  context: RequestContext,
  assetId: string,
  requestId: string,
): Promise<Response> {
  assertGenerationRole(context.currentWorkspace.role);
  if (!assetRecordIdPattern.test(assetId)) {
    throw assetNotFound();
  }
  const runtime = capability(env);
  if (runtime.mode !== "simulation") {
    throw new ApiError(
      409,
      "GENERATION_DISABLED",
      "生成工作目前未啟用；沒有呼叫任何外部供應商。",
    );
  }
  const idempotencyKey = request.headers.get("idempotency-key")?.trim() ?? "";
  if (!idempotencyKeyPattern.test(idempotencyKey)) {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      "生成要求必須包含有效的 Idempotency-Key。",
    );
  }
  const parsed = generationJobStartInputSchema.safeParse(
    await readBoundedJson(request),
  );
  if (!parsed.success) {
    throw new ApiError(400, "VALIDATION_ERROR", "生成工作內容無效。");
  }
  const workspaceId = context.currentWorkspace.id;
  const existing = await findGenerationJob(
    env.DB,
    workspaceId,
    "idempotency_key",
    idempotencyKey,
  );
  if (existing) {
    if (existing.asset_id !== assetId) {
      throw new ApiError(
        409,
        "IDEMPOTENCY_KEY_REUSED",
        "此 Idempotency-Key 已用於另一項生成要求。",
      );
    }
    await ensureWorkflowStarted(
      env.ASSET_GENERATION,
      existing,
      {
        jobId: existing.id,
        workspaceId,
        assetId: existing.asset_id,
        requestedReviewVersion: existing.requested_review_version,
      },
      false,
    );
    return Response.json(mapGenerationJob(existing), {
      headers: { "cache-control": "no-store" },
    });
  }
  const active = await findActiveGenerationJob(env.DB, workspaceId, assetId);
  if (active) {
    throw new ApiError(
      409,
      "GENERATION_ALREADY_ACTIVE",
      "此素材已有進行中的生成工作。",
    );
  }
  const asset = await findAsset(env.DB, workspaceId, assetId);
  if (!asset) {
    throw assetNotFound();
  }
  if (asset.status === "approved") {
    throw new ApiError(409, "ASSET_LOCKED", "已核准素材不可建立生成工作。");
  }
  if (asset.review_version !== parsed.data.expectedVersion) {
    throw new ApiError(
      409,
      "ASSET_VERSION_CONFLICT",
      "素材已更新，請重新載入後再建立生成工作。",
    );
  }
  if (!asset.source_object_key || !asset.source_sha256) {
    throw new ApiError(
      409,
      "GENERATION_SOURCE_REQUIRED",
      "必須先上載私人來源圖片。",
    );
  }
  if (asset.source_rights_confirmed !== 1) {
    throw new ApiError(
      409,
      "GENERATION_RIGHTS_REQUIRED",
      "必須先儲存來源圖片使用權確認。",
    );
  }

  const jobId = `generation_${crypto.randomUUID()}`;
  const auditMetadata = JSON.stringify({
    kind: "simulation",
    maxCostMinor: runtime.maxCostMinor,
  });
  try {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO generation_jobs (
             id, workspace_id, asset_id, requested_by, status,
             execution_mode, idempotency_key, workflow_instance_id,
             requested_review_version, input_sha256, max_cost_minor
           ) VALUES (
             ?1, ?2, ?3, ?4, 'queued', 'simulation', ?5, ?1, ?6, ?7, ?8
           )`,
      ).bind(
        jobId,
        workspaceId,
        assetId,
        context.user.id,
        idempotencyKey,
        parsed.data.expectedVersion,
        asset.source_sha256,
        runtime.maxCostMinor,
      ),
      env.DB.prepare(
        `INSERT INTO generation_job_events (
             id, workspace_id, job_id, status, event_type, metadata_json
           )
           SELECT ?1, workspace_id, id, 'queued', 'requested', ?2
           FROM generation_jobs
           WHERE workspace_id = ?3 AND id = ?4 AND changes() = 1`,
      ).bind(crypto.randomUUID(), auditMetadata, workspaceId, jobId),
      env.DB.prepare(
        `INSERT INTO audit_events (
             id, workspace_id, user_id, action, target_type, target_id,
             request_id, metadata_json
           )
           SELECT ?1, workspace_id, ?2, 'generation.request',
                  'generation_job', id, ?3, ?4
           FROM generation_jobs
           WHERE workspace_id = ?5 AND id = ?6 AND changes() = 1`,
      ).bind(
        crypto.randomUUID(),
        context.user.id,
        requestId,
        auditMetadata,
        workspaceId,
        jobId,
      ),
    ]);
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE")) {
      const duplicate = await findGenerationJob(
        env.DB,
        workspaceId,
        "idempotency_key",
        idempotencyKey,
      );
      if (duplicate) {
        return Response.json(mapGenerationJob(duplicate), {
          headers: { "cache-control": "no-store" },
        });
      }
      if (await findActiveGenerationJob(env.DB, workspaceId, assetId)) {
        throw new ApiError(
          409,
          "GENERATION_ALREADY_ACTIVE",
          "此素材已有進行中的生成工作。",
        );
      }
    }
    throw error;
  }

  const created = await findGenerationJob(env.DB, workspaceId, "id", jobId);
  if (!created) {
    throw new Error("Created generation job could not be read.");
  }
  try {
    await ensureWorkflowStarted(
      env.ASSET_GENERATION,
      created,
      {
        jobId,
        workspaceId,
        assetId,
        requestedReviewVersion: parsed.data.expectedVersion,
      },
      true,
    );
  } catch {
    await markStartFailure(env.DB, workspaceId, jobId, requestId);
    throw new ApiError(
      503,
      "GENERATION_START_FAILED",
      "生成工作未能啟動；沒有產生供應商費用。",
    );
  }
  return Response.json(mapGenerationJob(created), {
    status: 202,
    headers: { "cache-control": "no-store" },
  });
}
