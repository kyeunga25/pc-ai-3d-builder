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
import {
  entitlementTransitionStatements,
  generationCreditSummary,
  generationCustomerCreditUnits,
  syntheticProviderCostLimitUnits,
} from "../generation/accounting";
import { generationRuntimeConfig } from "../generation/provider";
import { ApiError } from "../lib/api-error";
import { privateObjectMetadataMatches } from "../lib/private-assets";
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
  entitlement_status: "released" | "reserved" | "settled" | null;
  provider_cost_units: number | null;
  validation_code: string | null;
  created_at: string;
  updated_at: string;
};

type GenerationRouteEnv = {
  ASSET_GENERATION: Workflow<AssetGenerationParams>;
  DB: D1Database;
  GENERATION_MAX_COST_MINOR: string;
  GENERATION_MODE: string;
  PRIVATE_ASSETS: R2Bucket;
};

const idempotencyKeyPattern = /^[A-Za-z0-9._:-]{8,128}$/u;

const generationJobSelect = `SELECT j.id, j.asset_id, j.status,
                                    j.execution_mode,
                                    j.workflow_instance_id,
                                    j.requested_review_version,
                                    j.output_object_key, j.failure_code,
                                    j.provider_cost_units, j.validation_code,
                                    e.status AS entitlement_status,
                                    j.created_at, j.updated_at
                             FROM generation_jobs AS j
                             LEFT JOIN generation_job_entitlements AS e
                               ON e.workspace_id = j.workspace_id
                              AND e.job_id = j.id`;

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

function generationSourceRequired(): ApiError {
  return new ApiError(
    409,
    "GENERATION_SOURCE_REQUIRED",
    "必須先上載可安全讀取的私人來源圖片。 / Upload a safely readable private source image before generating.",
  );
}

function assetVersionConflict(): ApiError {
  return new ApiError(
    409,
    "ASSET_VERSION_CONFLICT",
    "素材或所屬產品已更新，請重新載入後再建立生成工作。 / The asset or catalogue part changed; reload before generating.",
  );
}

function mapGenerationJob(row: GenerationJobRow): GenerationJob {
  return generationJobSchema.parse({
    id: row.id,
    assetId: row.asset_id,
    status: row.status,
    kind: row.execution_mode,
    outputReady: row.output_object_key !== null,
    failureCode: row.failure_code,
    entitlementStatus: row.entitlement_status,
    providerCostUnits: row.provider_cost_units,
    validationCode: row.validation_code,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

async function capability(
  env: GenerationRouteEnv,
  workspaceId: string,
): Promise<GenerationCapability> {
  return {
    ...generationRuntimeConfig(env),
    credits: await generationCreditSummary(env.DB, workspaceId),
  };
}

async function findGenerationJob(
  db: D1Database,
  workspaceId: string,
  clause: "id" | "idempotency_key",
  value: string,
): Promise<GenerationJobRow | null> {
  return db
    .prepare(
      `${generationJobSelect}
       WHERE j.workspace_id = ?1 AND j.${clause} = ?2
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
      `${generationJobSelect}
       WHERE j.workspace_id = ?1
         AND j.asset_id = ?2
         AND (
           j.status IN ('queued', 'running', 'validating')
           OR (j.status = 'awaiting_review' AND e.status = 'reserved')
         )
       ORDER BY j.created_at DESC, j.id DESC
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
    ...entitlementTransitionStatements(db, {
      workspaceId,
      jobId,
      transition: "released",
      reasonCode: "start_failed",
    }),
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
    `${generationJobSelect}
       WHERE j.workspace_id = ?1 AND j.asset_id = ?2
       ORDER BY j.created_at DESC, j.id DESC
       LIMIT 20`,
  )
    .bind(context.currentWorkspace.id, assetId)
    .all<GenerationJobRow>();
  const body = generationJobListResponseSchema.parse({
    capability: await capability(env, context.currentWorkspace.id),
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
  const runtime = generationRuntimeConfig(env);
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
    if (["queued", "running", "validating"].includes(existing.status)) {
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
    }
    return Response.json(mapGenerationJob(existing), {
      headers: { "cache-control": "no-store" },
    });
  }
  const active = await findActiveGenerationJob(env.DB, workspaceId, assetId);
  if (active) {
    throw new ApiError(
      409,
      "GENERATION_ALREADY_ACTIVE",
      "此素材已有進行中或等待人工決定的生成工作。",
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
    throw assetVersionConflict();
  }
  if (
    !asset.source_object_key ||
    !asset.source_content_type ||
    !Number.isSafeInteger(asset.source_size_bytes) ||
    asset.source_size_bytes === null ||
    asset.source_size_bytes <= 0 ||
    !asset.source_sha256
  ) {
    throw generationSourceRequired();
  }
  if (asset.source_rights_confirmed !== 1) {
    throw new ApiError(
      409,
      "GENERATION_RIGHTS_REQUIRED",
      "必須先儲存來源圖片使用權確認。",
    );
  }
  if (
    !(await privateObjectMetadataMatches(
      env.PRIVATE_ASSETS,
      asset.source_object_key,
      asset.source_content_type,
      asset.source_size_bytes,
    ))
  ) {
    throw generationSourceRequired();
  }

  const jobId = `generation_${crypto.randomUUID()}`;
  const auditMetadata = JSON.stringify({
    creditUnits: generationCustomerCreditUnits,
    kind: "simulation",
    maxCostMinor: runtime.maxCostMinor,
    maxProviderCostUnits: syntheticProviderCostLimitUnits,
  });
  let creditReservation: D1Result<unknown> | undefined;
  try {
    [creditReservation] = await env.DB.batch([
      env.DB.prepare(
        `UPDATE generation_credit_accounts
           SET available_units = available_units - ?1,
               reserved_units = reserved_units + ?1,
               updated_at = CURRENT_TIMESTAMP
           WHERE workspace_id = ?2 AND available_units >= ?1`,
      ).bind(generationCustomerCreditUnits, workspaceId),
      env.DB.prepare(
        `INSERT INTO generation_jobs (
             id, workspace_id, asset_id, requested_by, status,
             execution_mode, idempotency_key, workflow_instance_id,
             requested_review_version, input_sha256, max_cost_minor,
             max_provider_cost_units
           )
           SELECT ?1, ?2, ?3, ?4, 'queued', 'simulation', ?5, ?1,
                  ?6, ?7, ?8, ?9
           FROM generation_credit_accounts
           WHERE workspace_id = ?2 AND changes() = 1`,
      ).bind(
        jobId,
        workspaceId,
        assetId,
        context.user.id,
        idempotencyKey,
        parsed.data.expectedVersion,
        asset.source_sha256,
        runtime.maxCostMinor,
        syntheticProviderCostLimitUnits,
      ),
      env.DB.prepare(
        `INSERT INTO generation_job_entitlements (
           workspace_id, job_id, units, status
         )
         SELECT workspace_id, id, ?1, 'reserved'
         FROM generation_jobs
         WHERE workspace_id = ?2 AND id = ?3 AND changes() = 1`,
      ).bind(generationCustomerCreditUnits, workspaceId, jobId),
      env.DB.prepare(
        `INSERT INTO generation_credit_events (
           id, workspace_id, job_id, event_type, units, reason_code
         )
         SELECT ?1, workspace_id, job_id, 'reserve', units, 'generation_requested'
         FROM generation_job_entitlements
         WHERE workspace_id = ?2 AND job_id = ?3 AND changes() = 1`,
      ).bind(crypto.randomUUID(), workspaceId, jobId),
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
    if (
      error instanceof Error &&
      error.message.includes("GENERATION_INPUT_STALE")
    ) {
      throw assetVersionConflict();
    }
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
          "此素材已有進行中或等待人工決定的生成工作。",
        );
      }
    }
    throw error;
  }

  if (creditReservation?.meta.changes !== 1) {
    throw new ApiError(
      409,
      "GENERATION_CREDITS_REQUIRED",
      "目前沒有可保留的 3D 素材 credit；沒有建立工作或產生供應商成本。",
    );
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
