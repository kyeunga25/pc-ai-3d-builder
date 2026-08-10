import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers";

import {
  AssetFileValidationError,
  assetFileLimits,
  assetSourceContentTypeSchema,
  validateAssetFileBytes,
  type AssetSourceContentType,
} from "../../shared/domain/asset-files";
import type { AssetGenerationParams } from "../../shared/domain/generation-jobs";
import {
  GlbValidationError,
  validateGeneratedGlb,
  type GlbValidationReport,
} from "../../shared/domain/glb-validation";
import { entitlementTransitionStatements } from "../generation/accounting";
import {
  createGenerationProvider,
  GenerationProviderUnavailableError,
  generationOutputRequirements,
  generationRuntimeConfig,
} from "../generation/provider";
import {
  beginProviderAttempt,
  completeProviderAttempt,
  ProviderAttemptStateError,
  recordProviderValidation,
} from "../generation/provider-attempts";
import {
  generationClaimDisposition,
  generationStageFailure,
} from "../generation/job-guards";
import { pseudonymousGenerationRef, sha256Hex } from "../lib/digest";
import {
  assetObjectKey,
  deletePrivateObjectQuietly,
  privateObjectMatches,
  putPrivateObject,
} from "../lib/private-assets";

type GenerationStateRow = {
  job_id: string;
  job_status: string;
  requested_by: string | null;
  requested_review_version: number;
  input_sha256: string;
  max_cost_minor: number;
  max_provider_cost_units: number;
  output_object_key: string | null;
  previous_model_object_key: string | null;
  asset_status: string;
  catalogue_status: string;
  review_version: number;
  source_rights_confirmed: number;
  source_object_key: string | null;
  source_content_type: string | null;
  source_size_bytes: number | null;
  source_sha256: string | null;
  model_object_key: string | null;
  entitlement_status: string | null;
};

type ClaimedGeneration =
  | { disposition: "completed" }
  | { disposition: "rejected"; failureCode: string }
  | {
      disposition: "runnable";
      inputSha256: string;
      maxCostMinor: number;
      maxProviderCostUnits: number;
      requestedBy: string | null;
      source: {
        contentType: AssetSourceContentType;
        objectKey: string;
        sha256: string;
        sizeBytes: number;
      };
    };

type DraftArtifact = {
  attemptKey: string;
  contentType: "model/gltf-binary";
  durationMs: number;
  objectKey: string;
  providerCostUnits: number;
  sha256: string;
  sizeBytes: number;
  validation: GlbValidationReport;
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
              j.max_provider_cost_units,
              j.output_object_key, j.previous_model_object_key,
              a.status AS asset_status, p.status AS catalogue_status,
              a.review_version,
              a.source_rights_confirmed, a.source_object_key,
              a.source_content_type, a.source_size_bytes, a.source_sha256,
              a.model_object_key, e.status AS entitlement_status
       FROM generation_jobs AS j
       INNER JOIN product_assets AS a
         ON a.workspace_id = j.workspace_id AND a.id = j.asset_id
       INNER JOIN catalog_parts AS p
         ON p.workspace_id = a.workspace_id AND p.id = a.catalog_part_id
       LEFT JOIN generation_job_entitlements AS e
         ON e.workspace_id = j.workspace_id AND e.job_id = j.id
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
    ...entitlementTransitionStatements(db, {
      workspaceId: params.workspaceId,
      jobId: params.jobId,
      transition: "released",
      reasonCode: "generation_failed",
    }),
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
  if (
    current.catalogue_status !== "active" &&
    ["queued", "running", "validating"].includes(current.job_status)
  ) {
    await markGenerationFailed(db, params, "GENERATION_INPUT_STALE");
    return {
      disposition: "rejected",
      failureCode: "GENERATION_INPUT_STALE",
    };
  }
  const disposition = generationClaimDisposition(
    {
      assetStatus: current.asset_status,
      entitlementStatus: current.entitlement_status,
      inputSha256: current.input_sha256,
      jobStatus: current.job_status,
      maxProviderCostUnits: current.max_provider_cost_units,
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
    return { disposition: "completed" };
  }
  if (disposition.kind === "rejected") {
    if (
      disposition.code === "GENERATION_INPUT_STALE" ||
      disposition.code === "GENERATION_ENTITLEMENT_MISSING"
    ) {
      await markGenerationFailed(db, params, disposition.code);
      return { disposition: "rejected", failureCode: disposition.code };
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
             AND status = 'queued'
             AND EXISTS (
               SELECT 1
               FROM product_assets AS a
               INNER JOIN catalog_parts AS p
                 ON p.workspace_id = a.workspace_id
                AND p.id = a.catalog_part_id
               WHERE a.workspace_id = generation_jobs.workspace_id
                 AND a.id = generation_jobs.asset_id
                 AND p.status = 'active'
             )`,
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
      if (
        current &&
        current.catalogue_status !== "active" &&
        ["queued", "running", "validating"].includes(current.job_status)
      ) {
        await markGenerationFailed(db, params, "GENERATION_INPUT_STALE");
        return {
          disposition: "rejected",
          failureCode: "GENERATION_INPUT_STALE",
        };
      }
    } else {
      current = { ...current, job_status: "running" };
    }
  }
  if (!current || !["running", "validating"].includes(current.job_status)) {
    throw new GenerationWorkflowStateError("GENERATION_JOB_NOT_RUNNABLE");
  }
  const sourceContentType = assetSourceContentTypeSchema.safeParse(
    current.source_content_type,
  );
  if (
    !sourceContentType.success ||
    !Number.isSafeInteger(current.source_size_bytes) ||
    current.source_size_bytes === null ||
    current.source_size_bytes <= 0 ||
    current.source_size_bytes > assetFileLimits.source ||
    !current.source_object_key ||
    !current.source_sha256
  ) {
    await markGenerationFailed(db, params, "GENERATION_INPUT_INVALID");
    throw new GenerationWorkflowStateError("GENERATION_INPUT_INVALID");
  }
  return {
    disposition: "runnable",
    inputSha256: current.input_sha256,
    maxCostMinor: current.max_cost_minor,
    maxProviderCostUnits: current.max_provider_cost_units,
    requestedBy: current.requested_by,
    source: {
      contentType: sourceContentType.data,
      objectKey: current.source_object_key,
      sha256: current.source_sha256,
      sizeBytes: current.source_size_bytes,
    },
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
  if (current.job_status === "awaiting_review") {
    await deletePrivateObjectQuietly(env.PRIVATE_ASSETS, draft.objectKey);
    throw new GenerationWorkflowStateError("GENERATION_RESULT_LATE");
  }
  if (current.catalogue_status !== "active") {
    await deletePrivateObjectQuietly(env.PRIVATE_ASSETS, draft.objectKey);
    await markGenerationFailed(env.DB, params, "GENERATION_INPUT_STALE");
    throw new GenerationWorkflowStateError("GENERATION_INPUT_STALE");
  }
  const stageFailure = generationStageFailure(
    {
      assetStatus: current.asset_status,
      entitlementStatus: current.entitlement_status,
      inputSha256: current.input_sha256,
      jobStatus: current.job_status,
      maxProviderCostUnits: current.max_provider_cost_units,
      outputObjectKey: current.output_object_key,
      requestedReviewVersion: current.requested_review_version,
      reviewVersion: current.review_version,
      sourceObjectKey: current.source_object_key,
      sourceRightsConfirmed: current.source_rights_confirmed,
      sourceSha256: current.source_sha256,
    },
    params.requestedReviewVersion,
    draft.providerCostUnits,
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
             AND status <> 'approved'
             AND EXISTS (
               SELECT 1
               FROM catalog_parts AS p
               WHERE p.workspace_id = product_assets.workspace_id
                 AND p.id = product_assets.catalog_part_id
                 AND p.status = 'active'
             )`,
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
           SET status = 'awaiting_review', actual_cost_minor = 0,
               provider_cost_units = ?1, validation_code = ?2,
               output_object_key = ?3, output_content_type = ?4,
               output_size_bytes = ?5, output_sha256 = ?6,
               previous_model_object_key = ?7, failure_code = NULL,
               updated_at = CURRENT_TIMESTAMP, completed_at = CURRENT_TIMESTAMP
           WHERE workspace_id = ?8 AND id = ?9 AND asset_id = ?10
             AND status = 'validating' AND changes() = 1`,
      ).bind(
        draft.providerCostUnits,
        "GLB_VALID",
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
          dimensionMm: draft.validation.dimensionMm,
          providerCostUnits: draft.providerCostUnits,
          reviewVersion: nextReviewVersion,
          sizeBytes: draft.sizeBytes,
          textureCount: draft.validation.textureCount,
          triangleCount: draft.validation.triangleCount,
          validationCode: "GLB_VALID",
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

function generationFailureCode(error: unknown): string {
  if (error instanceof GenerationProviderUnavailableError) {
    return "GENERATION_KILL_SWITCH";
  }
  if (error instanceof GenerationWorkflowStateError) {
    return error.code;
  }
  if (error instanceof ProviderAttemptStateError) {
    return error.code;
  }
  if (error instanceof GlbValidationError) {
    return `GENERATION_OUTPUT_${error.code.slice(4)}`;
  }
  if (error instanceof AssetFileValidationError) {
    return error.code.startsWith("GLB_")
      ? `GENERATION_OUTPUT_${error.code.slice(4)}`
      : "GENERATION_OUTPUT_INVALID";
  }
  return "GENERATION_WORKFLOW_FAILED";
}

async function recordValidationFailure(
  db: D1Database,
  params: AssetGenerationParams,
  attemptKey: string,
  error: unknown,
): Promise<void> {
  const failureCode = generationFailureCode(error);
  if (
    failureCode.startsWith("GENERATION_OUTPUT_") ||
    failureCode === "GENERATION_COST_CAP_EXCEEDED" ||
    failureCode === "GENERATION_CHECKSUM_MISMATCH"
  ) {
    await recordProviderValidation(db, {
      workspaceId: params.workspaceId,
      jobId: params.jobId,
      attemptKey,
      validationCode: failureCode,
    });
  }
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
    const attemptKey = "primary";
    let attemptStarted = false;
    let draft: DraftArtifact | null = null;
    try {
      const claim = await step.do("claim generation job", stepConfig, () =>
        claimGenerationJob(this.env.DB, params),
      );
      if (claim.disposition === "completed") {
        return { jobId: params.jobId, status: "awaiting_review" };
      }
      if (claim.disposition === "rejected") {
        throw new GenerationWorkflowStateError(claim.failureCode);
      }

      const sourceReady = await step.do(
        "verify source object",
        stepConfig,
        () =>
          privateObjectMatches(
            this.env.PRIVATE_ASSETS,
            claim.source.objectKey,
            "source",
            claim.source.contentType,
            claim.source.sizeBytes,
            claim.source.sha256,
          ),
      );
      if (!sourceReady) {
        throw new GenerationWorkflowStateError("GENERATION_INPUT_MISSING");
      }

      await step.do("begin provider attempt", stepConfig, async () => {
        await beginProviderAttempt(this.env.DB, {
          workspaceId: params.workspaceId,
          jobId: params.jobId,
          attemptKey,
        });
      });
      attemptStarted = true;

      draft = await step.do("produce synthetic draft", stepConfig, async () => {
        const runtime = generationRuntimeConfig(this.env);
        if (
          runtime.mode !== "simulation" ||
          runtime.maxCostMinor > claim.maxCostMinor
        ) {
          throw new GenerationWorkflowStateError("GENERATION_KILL_SWITCH");
        }
        const [attemptRef, jobRef, workspaceRef] = await Promise.all([
          pseudonymousGenerationRef("attempt", `${params.jobId}:${attemptKey}`),
          pseudonymousGenerationRef("job", params.jobId),
          pseudonymousGenerationRef("workspace", params.workspaceId),
        ]);
        const startedAt = Date.now();
        const generated = await createGenerationProvider(
          runtime.mode,
        ).generateDraft({
          attemptRef,
          jobRef,
          workspaceRef,
          source: {
            contentType: claim.source.contentType,
            sha256: claim.source.sha256,
            sizeBytes: claim.source.sizeBytes,
          },
          requirements: generationOutputRequirements,
        });
        const durationMs = Math.max(0, Date.now() - startedAt);
        if (
          !Number.isSafeInteger(generated.providerCostUnits) ||
          generated.providerCostUnits < 0
        ) {
          throw new GenerationWorkflowStateError(
            "GENERATION_PROVIDER_RESULT_INVALID",
          );
        }
        await completeProviderAttempt(this.env.DB, {
          workspaceId: params.workspaceId,
          jobId: params.jobId,
          attemptKey,
          status: "succeeded",
          costUnits: generated.providerCostUnits,
          durationMs,
        });
        if (generated.providerCostUnits > claim.maxProviderCostUnits) {
          const error = new GenerationWorkflowStateError(
            "GENERATION_COST_CAP_EXCEEDED",
          );
          await recordValidationFailure(this.env.DB, params, attemptKey, error);
          throw error;
        }
        let contentType: "model/gltf-binary";
        let validation: GlbValidationReport;
        try {
          contentType = validateAssetFileBytes(
            "model",
            generated.contentType,
            generated.bytes,
          );
          validation = validateGeneratedGlb(
            generated.bytes,
            generationOutputRequirements,
          );
        } catch (error) {
          await recordValidationFailure(this.env.DB, params, attemptKey, error);
          throw error;
        }
        const objectKey = assetObjectKey(
          params.workspaceId,
          params.assetId,
          "model",
          `simulation-${params.jobId}-${attemptKey}`,
        );
        const sha256 = await sha256Hex(generated.bytes);
        await putPrivateObject(
          this.env.PRIVATE_ASSETS,
          objectKey,
          generated.bytes,
          contentType,
          sha256,
        );
        return {
          attemptKey,
          contentType,
          durationMs,
          objectKey,
          providerCostUnits: generated.providerCostUnits,
          sha256,
          sizeBytes: generated.bytes.byteLength,
          validation,
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
            throw new GenerationWorkflowStateError("GENERATION_OUTPUT_MISSING");
          }
          const bytes = new Uint8Array(await object.arrayBuffer());
          try {
            validateAssetFileBytes("model", draft.contentType, bytes);
            const validation = validateGeneratedGlb(
              bytes,
              generationOutputRequirements,
            );
            if (
              bytes.byteLength !== draft.sizeBytes ||
              (await sha256Hex(bytes)) !== draft.sha256
            ) {
              throw new GenerationWorkflowStateError(
                "GENERATION_CHECKSUM_MISMATCH",
              );
            }
            await recordProviderValidation(this.env.DB, {
              workspaceId: params.workspaceId,
              jobId: params.jobId,
              attemptKey: draft.attemptKey,
              validationCode: "GLB_VALID",
            });
            return { ...draft, validation };
          } catch (error) {
            await recordValidationFailure(
              this.env.DB,
              params,
              draft.attemptKey,
              error,
            );
            throw error;
          }
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
      const failureCode = generationFailureCode(error);
      await step.do("record generation failure", stepConfig, async () => {
        if (draft) {
          await deletePrivateObjectQuietly(
            this.env.PRIVATE_ASSETS,
            draft.objectKey,
          );
        }
        if (attemptStarted && !draft) {
          try {
            await completeProviderAttempt(this.env.DB, {
              workspaceId: params.workspaceId,
              jobId: params.jobId,
              attemptKey,
              status: "failed",
              costUnits: 0,
              durationMs: 0,
            });
          } catch {
            // A succeeded or concurrently completed attempt must stay immutable.
          }
        }
        await markGenerationFailed(this.env.DB, params, failureCode);
      });
      // Raw provider or platform errors must not escape into Workflow logs.
      // eslint-disable-next-line preserve-caught-error
      throw new Error("Generation workflow failed.");
    }
  }
}
