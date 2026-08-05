import type {
  GenerationCreditSummary,
  GenerationEntitlementStatus,
} from "../../shared/domain/generation-jobs";

export const generationCustomerCreditUnits = 1;
export const syntheticProviderCostLimitUnits = 1;

type CreditAccountRow = {
  available_units: number;
  reserved_units: number;
  settled_units: number;
  released_units: number;
};

export type ReservedGenerationJob = {
  jobId: string;
};

type EntitlementTransition = Extract<
  GenerationEntitlementStatus,
  "released" | "settled"
>;

type EntitlementTransitionInput = {
  workspaceId: string;
  jobId: string;
  transition: EntitlementTransition;
  reasonCode: string;
};

export async function generationCreditSummary(
  db: D1Database,
  workspaceId: string,
): Promise<GenerationCreditSummary> {
  const row = await db
    .prepare(
      `SELECT available_units, reserved_units, settled_units, released_units
       FROM generation_credit_accounts
       WHERE workspace_id = ?1
       LIMIT 1`,
    )
    .bind(workspaceId)
    .first<CreditAccountRow>();

  return {
    availableUnits: row?.available_units ?? 0,
    reservedUnits: row?.reserved_units ?? 0,
    settledUnits: row?.settled_units ?? 0,
    releasedUnits: row?.released_units ?? 0,
  };
}

export async function findReservedGenerationForAsset(
  db: D1Database,
  workspaceId: string,
  assetId: string,
  modelObjectKey: string | null,
): Promise<ReservedGenerationJob | null> {
  if (!modelObjectKey) {
    return null;
  }

  const row = await db
    .prepare(
      `SELECT j.id AS job_id
       FROM generation_jobs AS j
       INNER JOIN generation_job_entitlements AS e
         ON e.workspace_id = j.workspace_id AND e.job_id = j.id
       WHERE j.workspace_id = ?1 AND j.asset_id = ?2
         AND j.output_object_key = ?3
         AND j.status = 'awaiting_review'
         AND e.status = 'reserved'
       ORDER BY j.created_at DESC, j.id DESC
       LIMIT 1`,
    )
    .bind(workspaceId, assetId, modelObjectKey)
    .first<{ job_id: string }>();

  return row ? { jobId: row.job_id } : null;
}

export function entitlementTransitionStatements(
  db: D1Database,
  input: EntitlementTransitionInput,
): D1PreparedStatement[] {
  const release = input.transition === "released";
  const eventType = release ? "release" : "settle";

  return [
    db
      .prepare(
        `UPDATE generation_credit_accounts
         SET available_units = available_units +
               CASE WHEN ?1 = 'released' THEN (
                 SELECT units FROM generation_job_entitlements
                 WHERE workspace_id = ?2 AND job_id = ?3 AND status = 'reserved'
               ) ELSE 0 END,
             reserved_units = reserved_units - (
               SELECT units FROM generation_job_entitlements
               WHERE workspace_id = ?2 AND job_id = ?3 AND status = 'reserved'
             ),
             settled_units = settled_units +
               CASE WHEN ?1 = 'settled' THEN (
                 SELECT units FROM generation_job_entitlements
                 WHERE workspace_id = ?2 AND job_id = ?3 AND status = 'reserved'
               ) ELSE 0 END,
             released_units = released_units +
               CASE WHEN ?1 = 'released' THEN (
                 SELECT units FROM generation_job_entitlements
                 WHERE workspace_id = ?2 AND job_id = ?3 AND status = 'reserved'
               ) ELSE 0 END,
             updated_at = CURRENT_TIMESTAMP
         WHERE workspace_id = ?2 AND changes() = 1
           AND EXISTS (
             SELECT 1 FROM generation_job_entitlements
             WHERE workspace_id = ?2 AND job_id = ?3 AND status = 'reserved'
           )
           AND reserved_units >= (
             SELECT units FROM generation_job_entitlements
             WHERE workspace_id = ?2 AND job_id = ?3 AND status = 'reserved'
           )`,
      )
      .bind(input.transition, input.workspaceId, input.jobId),
    db
      .prepare(
        `UPDATE generation_job_entitlements
         SET status = ?1,
             settled_at = CASE WHEN ?1 = 'settled' THEN CURRENT_TIMESTAMP ELSE settled_at END,
             released_at = CASE WHEN ?1 = 'released' THEN CURRENT_TIMESTAMP ELSE released_at END,
             release_reason_code = CASE WHEN ?1 = 'released' THEN ?2 ELSE NULL END
         WHERE workspace_id = ?3 AND job_id = ?4
           AND status = 'reserved' AND changes() = 1`,
      )
      .bind(
        input.transition,
        release ? input.reasonCode : null,
        input.workspaceId,
        input.jobId,
      ),
    db
      .prepare(
        `INSERT INTO generation_credit_events (
           id, workspace_id, job_id, event_type, units, reason_code
         )
         SELECT ?1, workspace_id, job_id, ?2, units, ?3
         FROM generation_job_entitlements
         WHERE workspace_id = ?4 AND job_id = ?5
           AND status = ?6 AND changes() = 1`,
      )
      .bind(
        crypto.randomUUID(),
        eventType,
        input.reasonCode,
        input.workspaceId,
        input.jobId,
        input.transition,
      ),
  ];
}

export function generationReviewAccountingStatements(
  db: D1Database,
  input: {
    workspaceId: string;
    jobId: string;
    action: "approve" | "reject";
  },
): D1PreparedStatement[] {
  const rejected = input.action === "reject";
  const failureCode = rejected ? "GENERATION_REVIEW_REJECTED" : null;

  const jobTransition = db
    .prepare(
      `UPDATE generation_jobs
       SET status = CASE WHEN ?1 = 'reject' THEN 'failed' ELSE status END,
           failure_code = CASE WHEN ?1 = 'reject' THEN ?2 ELSE failure_code END,
           updated_at = CURRENT_TIMESTAMP,
           completed_at = CASE
             WHEN ?1 = 'reject' THEN CURRENT_TIMESTAMP
             ELSE completed_at
           END
       WHERE workspace_id = ?3 AND id = ?4
         AND status = 'awaiting_review' AND changes() = 1`,
    )
    .bind(input.action, failureCode, input.workspaceId, input.jobId);

  const jobEvent = db
    .prepare(
      `INSERT INTO generation_job_events (
         id, workspace_id, job_id, status, event_type, failure_code
       )
       SELECT ?1, workspace_id, id,
              CASE WHEN ?2 = 'reject' THEN 'failed' ELSE 'awaiting_review' END,
              CASE WHEN ?2 = 'reject' THEN 'review_rejected' ELSE 'asset_approved' END,
              ?3
       FROM generation_jobs
       WHERE workspace_id = ?4 AND id = ?5 AND changes() = 1`,
    )
    .bind(
      crypto.randomUUID(),
      input.action,
      failureCode,
      input.workspaceId,
      input.jobId,
    );

  return [
    jobTransition,
    jobEvent,
    ...entitlementTransitionStatements(db, {
      workspaceId: input.workspaceId,
      jobId: input.jobId,
      transition: rejected ? "released" : "settled",
      reasonCode: rejected ? "review_rejected" : "asset_approved",
    }),
  ];
}

export function generationSupersededAccountingStatements(
  db: D1Database,
  input: { workspaceId: string; jobId: string },
): D1PreparedStatement[] {
  const failureCode = "GENERATION_DRAFT_SUPERSEDED";
  return [
    db
      .prepare(
        `UPDATE generation_jobs
         SET status = 'failed', failure_code = ?1,
             updated_at = CURRENT_TIMESTAMP, completed_at = CURRENT_TIMESTAMP
         WHERE workspace_id = ?2 AND id = ?3
           AND status = 'awaiting_review' AND changes() = 1`,
      )
      .bind(failureCode, input.workspaceId, input.jobId),
    db
      .prepare(
        `INSERT INTO generation_job_events (
           id, workspace_id, job_id, status, event_type, failure_code
         )
         SELECT ?1, workspace_id, id, 'failed', 'draft_superseded', ?2
         FROM generation_jobs
         WHERE workspace_id = ?3 AND id = ?4 AND changes() = 1`,
      )
      .bind(crypto.randomUUID(), failureCode, input.workspaceId, input.jobId),
    ...entitlementTransitionStatements(db, {
      workspaceId: input.workspaceId,
      jobId: input.jobId,
      transition: "released",
      reasonCode: "draft_superseded",
    }),
  ];
}
