export type ProviderAttemptStatus = "failed" | "started" | "succeeded";

export type ProviderAttemptState = {
  attemptKey: string;
  attemptStatus: ProviderAttemptStatus;
  jobStatus: string;
};

export type ProviderResultDisposition =
  | { kind: "apply" }
  | { kind: "duplicate" }
  | { code: string; kind: "rejected" };

type ProviderAttemptRow = {
  attempt_key: string;
  attempt_status: ProviderAttemptStatus;
  job_status: string;
};

export class ProviderAttemptStateError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "ProviderAttemptStateError";
  }
}

export function providerResultDisposition(
  state: ProviderAttemptState,
  incoming: {
    attemptKey: string;
    status: Exclude<ProviderAttemptStatus, "started">;
  },
): ProviderResultDisposition {
  if (incoming.attemptKey !== state.attemptKey) {
    return { kind: "rejected", code: "GENERATION_RESULT_OUT_OF_ORDER" };
  }

  if (state.attemptStatus !== "started") {
    return state.attemptStatus === incoming.status
      ? { kind: "duplicate" }
      : { kind: "rejected", code: "GENERATION_RESULT_CONFLICT" };
  }

  if (!["running", "validating"].includes(state.jobStatus)) {
    return { kind: "rejected", code: "GENERATION_RESULT_LATE" };
  }

  return { kind: "apply" };
}

async function loadProviderAttempt(
  db: D1Database,
  input: { workspaceId: string; jobId: string; attemptKey: string },
): Promise<ProviderAttemptRow | null> {
  return db
    .prepare(
      `SELECT a.attempt_key, a.status AS attempt_status, j.status AS job_status
       FROM generation_provider_attempts AS a
       INNER JOIN generation_jobs AS j
         ON j.workspace_id = a.workspace_id AND j.id = a.job_id
       WHERE a.workspace_id = ?1 AND a.job_id = ?2 AND a.attempt_key = ?3
       LIMIT 1`,
    )
    .bind(input.workspaceId, input.jobId, input.attemptKey)
    .first<ProviderAttemptRow>();
}

export async function beginProviderAttempt(
  db: D1Database,
  input: { workspaceId: string; jobId: string; attemptKey: string },
): Promise<void> {
  await db
    .prepare(
      `INSERT OR IGNORE INTO generation_provider_attempts (
         id, workspace_id, job_id, attempt_key, status
       ) VALUES (?1, ?2, ?3, ?4, 'started')`,
    )
    .bind(
      `attempt_${crypto.randomUUID()}`,
      input.workspaceId,
      input.jobId,
      input.attemptKey,
    )
    .run();

  if (!(await loadProviderAttempt(db, input))) {
    throw new ProviderAttemptStateError("GENERATION_ATTEMPT_MISSING");
  }
}

export async function completeProviderAttempt(
  db: D1Database,
  input: {
    workspaceId: string;
    jobId: string;
    attemptKey: string;
    status: "failed" | "succeeded";
    costUnits: number;
    durationMs: number;
  },
): Promise<"applied" | "duplicate"> {
  const current = await loadProviderAttempt(db, input);
  if (!current) {
    throw new ProviderAttemptStateError("GENERATION_ATTEMPT_MISSING");
  }
  const disposition = providerResultDisposition(
    {
      attemptKey: current.attempt_key,
      attemptStatus: current.attempt_status,
      jobStatus: current.job_status,
    },
    { attemptKey: input.attemptKey, status: input.status },
  );
  if (disposition.kind === "duplicate") {
    return "duplicate";
  }
  if (disposition.kind === "rejected") {
    throw new ProviderAttemptStateError(disposition.code);
  }

  const result = await db
    .prepare(
      `UPDATE generation_provider_attempts
       SET status = ?1, cost_units = ?2, duration_ms = ?3,
           updated_at = CURRENT_TIMESTAMP, completed_at = CURRENT_TIMESTAMP
       WHERE workspace_id = ?4 AND job_id = ?5 AND attempt_key = ?6
         AND status = 'started'`,
    )
    .bind(
      input.status,
      input.costUnits,
      input.durationMs,
      input.workspaceId,
      input.jobId,
      input.attemptKey,
    )
    .run();

  if (result.meta.changes === 1) {
    return "applied";
  }
  const latest = await loadProviderAttempt(db, input);
  if (latest?.attempt_status === input.status) {
    return "duplicate";
  }
  throw new ProviderAttemptStateError("GENERATION_RESULT_CONFLICT");
}

export async function recordProviderValidation(
  db: D1Database,
  input: {
    workspaceId: string;
    jobId: string;
    attemptKey: string;
    validationCode: string;
  },
): Promise<void> {
  const result = await db
    .prepare(
      `UPDATE generation_provider_attempts
       SET validation_code = ?1, updated_at = CURRENT_TIMESTAMP
       WHERE workspace_id = ?2 AND job_id = ?3 AND attempt_key = ?4
         AND status = 'succeeded'
         AND (validation_code IS NULL OR validation_code = ?1)`,
    )
    .bind(
      input.validationCode,
      input.workspaceId,
      input.jobId,
      input.attemptKey,
    )
    .run();

  if (result.meta.changes === 1) {
    return;
  }
  const current = await db
    .prepare(
      `SELECT validation_code
       FROM generation_provider_attempts
       WHERE workspace_id = ?1 AND job_id = ?2 AND attempt_key = ?3
       LIMIT 1`,
    )
    .bind(input.workspaceId, input.jobId, input.attemptKey)
    .first<{ validation_code: string | null }>();
  if (current?.validation_code !== input.validationCode) {
    throw new ProviderAttemptStateError("GENERATION_VALIDATION_CONFLICT");
  }
}
