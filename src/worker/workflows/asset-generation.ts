import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers";

import {
  assetFileLimits,
  validateAssetFileBytes,
} from "../../shared/domain/asset-files";
import type { AssetGenerationParams } from "../../shared/domain/generation-jobs";
import {
  createGenerationProvider,
  GenerationProviderUnavailableError,
  generationRuntimeConfig,
} from "../generation/provider";
import {
  generationClaimDisposition,
  generationStageFailure,
} from "../generation/job-guards";
import { sha256Hex } from "../lib/digest";
import {
  assetObjectKey,
  deletePrivateObjectQuietly,
  putPrivateObject,
} from "../lib/private-assets";

type GenerationStateRow = {
  job_id: string;
  job_status: string;
  requested_by: string | null;
  requested_review_version: number;
  input_sha256: string;
  max_cost_minor: number;
  output_object_key: string | null;
  previous_model_object_key: string | null;
  asset_status: string;
  review_version: number;
  source_rights_confirmed: number;
  source_object_key: string | null;
  source_sha256: string | null;
  model_object_key: string | null;
};

type ClaimedGeneration = {
  inputSha256: string;
  maxCostMinor: number;
  requestedBy: string | null;
};

type DraftArtifact = {
  actualCostMinor: number;
  contentType: "model/gltf-binary";
  objectKey: string;
  sha256: string;
  sizeBytes: number;
};

type StagedDraft = {
  previousModelObjectKey: string | null;
};

class GenerationWorkflowStateError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "GenerationWorkflowStateError";
  }
}

const stepConfig = {
  retries: { limit: 2, delay: "5 seconds", backoff: "exponential" },
  timeout: "1 minute",
} as const;

async function loadGenerationState(
  db: D1Database,
  params: AssetGenerationParams,
): Promise<GenerationStateRow | null> {
  return db
    .prepare(
      `SELECT j.id AS job_id, j.status AS job_status, j.requested_by,
              j.requested_review_version, j.input_sha256, j.max_cost_minor,
              j.output_object_key, j.previous_model_object_key,
              a.status AS asset_status, a.review_version,
              a.source_rights_confirmed, a.source_object_key, a.source_sha256,
              a.model_object_key
       FROM generation_jobs AS j
       INNER JOIN product_assets AS a
         ON a.workspace_id = j.workspace_id AND a.id = j.asset_id
       WHERE j.workspace_id = ?1 AND j.id = ?2 AND j.asset_id = ?3
       LIMIT 1`,
    )
    .bind(params.workspaceId, params.jobId, params.assetId)
    .first<GenerationStateRow>();
}

export async function markGenerationFailed(
  db: D1Database,
  params: AssetGenerationParams,
  failureCode: string,
): Promise<void> {
  await db.batch([
    db
      .prepare(
        `UPDATE generation_jobs
         SET status = 'failed', failure_code = ?1,
             updated_at = CURRENT_TIMESTAMP, completed_at = CURRENT_TIMESTAMP
         WHERE workspace_id = ?2 AND id = ?3 AND asset_id = ?4
           AND status NOT IN ('awaiting_review', 'failed', 'cancelled')`,
      )
      .bind(failureCode, params.workspaceId, params.jobId, params.assetId),
    db
      .prepare(
        `INSERT INTO generation_job_events (
           id, workspace_id, job_id, status, event_type, failure_code
         )
         SELECT ?1, workspace_id, id, 'failed', 'workflow_failed', ?2
         FROM generation_jobs
         WHERE workspace_id = ?3 AND id = ?4 AND asset_id = ?5
           AND status = 'failed' AND failure_code = ?2 AND changes() = 1`,
      )
      .bind(
        crypto.randomUUID(),
        failureCode,
        params.workspaceId,
        params.jobId,
        params.assetId,
      ),
    db
      .prepare(
        `INSERT INTO audit_events (
           id, workspace_id, user_id, action, target_type, target_id,
           request_id, metadata_json
         )
         SELECT ?1, workspace_id, requested_by, 'generation.workflow.failed',
                'generation_job', id, ?2, ?3
         FROM generation_jobs
         WHERE workspace_id = ?4 AND id = ?5 AND asset_id = ?6
           AND status = 'failed' AND failure_code = ?7 AND changes() = 1`,
      )
      .bind(
        crypto.randomUUID(),
        `workflow:${params.jobId}`,
        JSON.stringify({ failureCode }),
        params.workspaceId,
        params.jobId,
        params.assetId,
        failureCode,
      ),
  ]);
}

export async function claimGenerationJob(
  db: D1Database,
  params: AssetGenerationParams,
): Promise<ClaimedGeneration> {
  let current = await loadGenerationState(db, params);
  if (!current) {
    throw new GenerationWorkflowStateError("GENERATION_JOB_NOT_FOUND");
  }
  const disposition = generationClaimDisposition(
    {
      assetStatus: current.asset_status,
      inputSha256: current.input_sha256,
      jobStatus: current.job_status,
      maxCostMinor: current.max_cost_minor,
      outputObjectKey: current.output_object_key,
      requestedReviewVersion: current.requested_review_version,
      reviewVersion: current.review_version,
      sourceObjectKey: current.source_object_key,
      sourceRightsConfirmed: current.source_rights_confirmed,
      sourceSha256: current.source_sha256,
    },
    params.requestedReviewVersion,
  );
  if (disposition.kind === "completed") {
    return {
      inputSha256: current.input_sha256,
      maxCostMinor: current.max_cost_minor,
      requestedBy: current.requested_by,
    };
  }
  if (disposition.kind === "rejected") {
    if (disposition.code === "GENERATION_INPUT_STALE") {
      await markGenerationFailed(db, params, disposition.code);
    }
    throw new GenerationWorkflowStateError(disposition.code);
  }
  if (current.job_status === "queued") {
    const [updateResult] = await db.batch([
      db
        .prepare(
          `UPDATE generation_jobs
           SET status = 'running', updated_at = CURRENT_TIMESTAMP
           WHERE workspace_id = ?1 AND id = ?2 AND asset_id = ?3
             AND status = 'queued'`,
        )
        .bind(params.workspaceId, params.jobId, params.assetId),
      db
        .prepare(
          `INSERT INTO generation_job_events (
             id, workspace_id, job_id, status, event_type
           )
           SELECT ?1, workspace_id, id, 'running', 'workflow_started'
           FROM generation_jobs
           WHERE workspace_id = ?2 AND id = ?3 AND asset_id = ?4
             AND status = 'running' AND changes() = 1`,
        )
        .bind(
          crypto.randomUUID(),
          params.workspaceId,
          params.jobId,
          params.assetId,
        ),
    ]);
    if (updateResult?.meta.changes !== 1) {
      current = await loadGenerationState(db, params);
    } else {
      current = { ...current, job_status: "running" };
    }
  }
  if (!current || !["running", "validating"].includes(current.job_status)) {
    throw new GenerationWorkflowStateError("GENERATION_JOB_NOT_RUNNABLE");
  }
  return {
    inputSha256: current.input_sha256,
    maxCostMinor: current.max_cost_minor,
    requestedBy: current.requested_by,
  };
}

export async function markGenerationValidating(
  db: D1Database,
  params: AssetGenerationParams,
): Promise<void> {
  const [updateResult] = await db.batch([
    db
      .prepare(
        `UPDATE generation_jobs
         SET status = 'validating', updated_at = CURRENT_TIMESTAMP
         WHERE workspace_id = ?1 AND id = ?2 AND asset_id = ?3
           AND status = 'running'`,
      )
      .bind(params.workspaceId, params.jobId, params.assetId),
    db
      .prepare(
        `INSERT INTO generation_job_events (
           id, workspace_id, job_id, status, event_type
         )
         SELECT ?1, workspace_id, id, 'validating', 'draft_stored'
         FROM generation_jobs
         WHERE workspace_id = ?2 AND id = ?3 AND asset_id = ?4
           AND status = 'validating' AND changes() = 1`,
      )
      .bind(
        crypto.randomUUID(),
        params.workspaceId,
        params.jobId,
        params.assetId,
      ),
  ]);
  if (updateResult?.meta.changes === 1) {
    return;
  }
  const current = await loadGenerationState(db, params);
  if (
    !current ||
    !["validating", "awaiting_review"].includes(current.job_status)
  ) {
    throw new GenerationWorkflowStateError("GENERATION_JOB_NOT_RUNNABLE");
  }
}

export async function stageGeneratedDraft(
  env: Pick<Env, "DB" | "PRIVATE_ASSETS">,
  params: AssetGenerationParams,
  draft: DraftArtifact,
): Promise<StagedDraft> {
  const current = await loadGenerationState(env.DB, params);
  if (!current) {
    await deletePrivateObjectQuietly(env.PRIVATE_ASSETS, draft.objectKey);
    throw new GenerationWorkflowStateError("GENERATION_JOB_NOT_FOUND");
  }
  if (
    current.job_status === "awaiting_review" &&
    current.output_object_key === draft.objectKey
  ) {
    return { previousModelObjectKey: current.previous_model_object_key };
  }
  const stageFailure = generationStageFailure(
    {
      assetStatus: current.asset_status,
      inputSha256: current.input_sha256,
      jobStatus: current.job_status,
      maxCostMinor: current.max_cost_minor,
      outputObjectKey: current.output_object_key,
      requestedReviewVersion: current.requested_review_version,
      reviewVersion: current.review_version,
      sourceObjectKey: current.source_object_key,
      sourceRightsConfirmed: current.source_rights_confirmed,
      sourceSha256: current.source_sha256,
    },
    params.requestedReviewVersion,
    draft.actualCostMinor,
  );
  if (stageFailure) {
    await deletePrivateObjectQuietly(env.PRIVATE_ASSETS, draft.objectKey);
    await markGenerationFailed(env.DB, params, stageFailure);
    throw new GenerationWorkflowStateError(stageFailure);
  }
  const nextReviewVersion = params.requestedReviewVersion + 1;
  let results: D1Result<unknown>[];
  try {
    results = await env.DB.batch([
      env.DB.prepare(
        `UPDATE product_assets
           SET source_kind = 'generated',
               model_object_key = ?1,
               model_content_type = ?2,
               model_size_bytes = ?3,
               model_sha256 = ?4,
               status = 'draft', quality = 'unreviewed',
               completed_checks_json = '[]', source_rights_confirmed = 0,
               verified_width_mm = NULL, verified_height_mm = NULL,
               verified_depth_mm = NULL,
               review_version = review_version + 1,
               updated_by = ?5, approved_by = NULL, approved_at = NULL,
               rejected_at = NULL, updated_at = CURRENT_TIMESTAMP
           WHERE workspace_id = ?6 AND id = ?7 AND review_version = ?8
             AND source_sha256 = ?9 AND source_rights_confirmed = 1
             AND status <> 'approved'`,
      ).bind(
        draft.objectKey,
        draft.contentType,
        draft.sizeBytes,
        draft.sha256,
        current.requested_by,
        params.workspaceId,
        params.assetId,
        params.requestedReviewVersion,
        current.input_sha256,
      ),
      env.DB.prepare(
        `UPDATE generation_jobs
           SET status = 'awaiting_review', actual_cost_minor = ?1,
               output_object_key = ?2, output_content_type = ?3,
               output_size_bytes = ?4, output_sha256 = ?5,
               previous_model_object_key = ?6, failure_code = NULL,
               updated_at = CURRENT_TIMESTAMP, completed_at = CURRENT_TIMESTAMP
           WHERE workspace_id = ?7 AND id = ?8 AND asset_id = ?9
             AND status = 'validating' AND changes() = 1`,
      ).bind(
        draft.actualCostMinor,
        draft.objectKey,
        draft.contentType,
        draft.sizeBytes,
        draft.sha256,
        current.model_object_key,
        params.workspaceId,
        params.jobId,
        params.assetId,
      ),
      env.DB.prepare(
        `INSERT INTO generation_job_events (
             id, workspace_id, job_id, status, event_type, metadata_json
           )
           SELECT ?1, workspace_id, id, 'awaiting_review',
                  'draft_ready', ?2
           FROM generation_jobs
           WHERE workspace_id = ?3 AND id = ?4 AND asset_id = ?5
             AND status = 'awaiting_review' AND changes() = 1`,
      ).bind(
        crypto.randomUUID(),
        JSON.stringify({
          actualCostMinor: draft.actualCostMinor,
          reviewVersion: nextReviewVersion,
          sizeBytes: draft.sizeBytes,
        }),
        params.workspaceId,
        params.jobId,
        params.assetId,
      ),
      env.DB.prepare(
        `INSERT INTO audit_events (
             id, workspace_id, user_id, action, target_type, target_id,
             request_id, metadata_json
           )
           SELECT ?1, workspace_id, requested_by, 'generation.draft.ready',
                  'generation_job', id, ?2, ?3
           FROM generation_jobs
           WHERE workspace_id = ?4 AND id = ?5 AND asset_id = ?6
             AND status = 'awaiting_review' AND changes() = 1`,
      ).bind(
        crypto.randomUUID(),
        `workflow:${params.jobId}`,
        JSON.stringify({
          reviewVersion: nextReviewVersion,
          sizeBytes: draft.sizeBytes,
        }),
        params.workspaceId,
        params.jobId,
        params.assetId,
      ),
    ]);
  } catch (error) {
    await deletePrivateObjectQuietly(env.PRIVATE_ASSETS, draft.objectKey);
    throw error;
  }
  if (results[0]?.meta.changes !== 1 || results[1]?.meta.changes !== 1) {
    await deletePrivateObjectQuietly(env.PRIVATE_ASSETS, draft.objectKey);
    await markGenerationFailed(env.DB, params, "GENERATION_INPUT_STALE");
    throw new GenerationWorkflowStateError("GENERATION_INPUT_STALE");
  }
  return { previousModelObjectKey: current.model_object_key };
}

export class AssetGenerationWorkflow extends WorkflowEntrypoint<
  Env,
  AssetGenerationParams
> {
  override async run(
    event: Readonly<WorkflowEvent<AssetGenerationParams>>,
    step: WorkflowStep,
  ): Promise<{ jobId: string; status: "awaiting_review" }> {
    const params = event.payload;
    let draft: DraftArtifact | null = null;
    try {
      const claim = await step.do("claim generation job", stepConfig, () =>
        claimGenerationJob(this.env.DB, params),
      );
      draft = await step.do("produce synthetic draft", stepConfig, async () => {
        const runtime = generationRuntimeConfig(this.env);
        const generated = await createGenerationProvider(
          runtime.mode,
        ).generateDraft({
          jobId: params.jobId,
          inputSha256: claim.inputSha256,
        });
        if (generated.actualCostMinor > claim.maxCostMinor) {
          throw new GenerationWorkflowStateError(
            "GENERATION_COST_CAP_EXCEEDED",
          );
        }
        const contentType = validateAssetFileBytes(
          "model",
          generated.contentType,
          generated.bytes,
        );
        const objectKey = assetObjectKey(
          params.workspaceId,
          params.assetId,
          "model",
          `simulation-${params.jobId}`,
        );
        const sha256 = await sha256Hex(generated.bytes);
        await putPrivateObject(
          this.env.PRIVATE_ASSETS,
          objectKey,
          generated.bytes,
          contentType,
        );
        return {
          actualCostMinor: generated.actualCostMinor,
          contentType,
          objectKey,
          sha256,
          sizeBytes: generated.bytes.byteLength,
        };
      });
      await step.do("mark draft validating", stepConfig, () =>
        markGenerationValidating(this.env.DB, params),
      );
      const validatedDraft = await step.do(
        "validate stored draft",
        stepConfig,
        async () => {
          if (!draft) {
            throw new GenerationWorkflowStateError("GENERATION_OUTPUT_MISSING");
          }
          const object = await this.env.PRIVATE_ASSETS.get(draft.objectKey);
          if (
            !object ||
            !("body" in object) ||
            object.size > assetFileLimits.model
          ) {
            throw new GenerationWorkflowStateError("GENERATION_OUTPUT_INVALID");
          }
          const bytes = new Uint8Array(await object.arrayBuffer());
          validateAssetFileBytes("model", draft.contentType, bytes);
          if (
            bytes.byteLength !== draft.sizeBytes ||
            (await sha256Hex(bytes)) !== draft.sha256
          ) {
            throw new GenerationWorkflowStateError("GENERATION_OUTPUT_INVALID");
          }
          return draft;
        },
      );
      const staged = await step.do("stage review draft", stepConfig, () =>
        stageGeneratedDraft(this.env, params, validatedDraft),
      );
      await step.do("clean superseded model", stepConfig, () =>
        deletePrivateObjectQuietly(
          this.env.PRIVATE_ASSETS,
          staged.previousModelObjectKey,
        ),
      );
      return { jobId: params.jobId, status: "awaiting_review" };
    } catch (error) {
      const failureCode =
        error instanceof GenerationProviderUnavailableError ||
        (error instanceof GenerationWorkflowStateError &&
          error.code === "GENERATION_KILL_SWITCH")
          ? "GENERATION_KILL_SWITCH"
          : error instanceof GenerationWorkflowStateError
            ? error.code
            : "GENERATION_WORKFLOW_FAILED";
      await step.do("record generation failure", stepConfig, async () => {
        if (draft) {
          await deletePrivateObjectQuietly(
            this.env.PRIVATE_ASSETS,
            draft.objectKey,
          );
        }
        await markGenerationFailed(this.env.DB, params, failureCode);
      });
      // Raw provider or platform errors must not escape into Workflow logs.
      // eslint-disable-next-line preserve-caught-error
      throw new Error("Generation workflow failed.");
    }
  }
}
