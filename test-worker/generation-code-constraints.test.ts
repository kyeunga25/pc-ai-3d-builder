import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

const workspaceId = "workspace-generation-code-constraints";
const userId = "user-generation-code-constraints";
const partId = "part-generation-code-constraints";
const assetId = "asset-generation-code-constraints";
const jobId = "generation-code-constraints";
const sourceSha256 = "a".repeat(64);

async function seedGenerationJob(): Promise<void> {
  await env.DB.batch([
    env.DB.prepare(
      `INSERT OR IGNORE INTO workspaces (id, slug, name)
       VALUES (?1, ?2, 'Generation Code Constraints')`,
    ).bind(workspaceId, "generation-code-constraints"),
    env.DB.prepare(
      `INSERT OR IGNORE INTO users (id, email, display_name, last_workspace_id)
       VALUES (?1, ?2, 'Generation Code Fixture', ?3)`,
    ).bind(userId, "generation-code-constraints@example.invalid", workspaceId),
    env.DB.prepare(
      `INSERT OR IGNORE INTO catalog_parts (
         id, workspace_id, sku, category, manufacturer, model,
         price_minor, stock_status, specifications_json,
         specification_status, created_by, updated_by
       ) VALUES (
         ?1, ?2, 'GEN-CODE-001', 'gpu', 'Fixture', 'Code Boundary',
         0, 'unknown', '{}', 'verified', ?3, ?3
       )`,
    ).bind(partId, workspaceId, userId),
    env.DB.prepare(
      `INSERT OR IGNORE INTO product_assets (
         id, workspace_id, catalog_part_id, status, quality, source_kind,
         source_rights_confirmed, review_version, created_by, updated_by,
         source_object_key, source_content_type, source_size_bytes, source_sha256
       ) VALUES (
         ?1, ?2, ?3, 'draft', 'draft', 'uploaded', 1, 0, ?4, ?4,
         ?5, 'image/png', 8, ?6
       )`,
    ).bind(
      assetId,
      workspaceId,
      partId,
      userId,
      "workspaces/code-fixture/assets/source",
      sourceSha256,
    ),
    env.DB.prepare(
      `INSERT OR IGNORE INTO generation_jobs (
         id, workspace_id, asset_id, requested_by, status, execution_mode,
         idempotency_key, workflow_instance_id, requested_review_version,
         input_sha256, max_cost_minor, max_provider_cost_units, failure_code
       ) VALUES (
         ?1, ?2, ?3, ?4, 'failed', 'simulation', ?5, ?6, 0, ?7, 0, 1,
         'GENERATION_WORKFLOW_FAILED'
       )`,
    ).bind(
      jobId,
      workspaceId,
      assetId,
      userId,
      "generation-code-idempotency",
      "generation-code-workflow",
      sourceSha256,
    ),
  ]);
}

async function expectInvalidCode(
  statement: D1PreparedStatement,
): Promise<void> {
  await expect(statement.run()).rejects.toThrow(/GENERATION_CODE_INVALID/u);
}

describe("generation diagnostic code D1 constraints", () => {
  it("advances the explicit schema phase", async () => {
    const phase = await env.DB.prepare(
      "SELECT value FROM rigstage_metadata WHERE key = 'schema_phase'",
    ).first<{ value: string }>();

    expect(phase?.value).toBe("16");
  });

  it("rejects unsafe job, event and provider-attempt codes on insert and update", async () => {
    await seedGenerationJob();

    await expectInvalidCode(
      env.DB.prepare(
        "UPDATE generation_jobs SET failure_code = ?1 WHERE workspace_id = ?2 AND id = ?3",
      ).bind("private parser detail", workspaceId, jobId),
    );
    await expectInvalidCode(
      env.DB.prepare(
        "UPDATE generation_jobs SET validation_code = ?1 WHERE workspace_id = ?2 AND id = ?3",
      ).bind("GLB VALID", workspaceId, jobId),
    );
    await expectInvalidCode(
      env.DB.prepare(
        `INSERT INTO generation_jobs (
           id, workspace_id, asset_id, requested_by, status, execution_mode,
           idempotency_key, workflow_instance_id, requested_review_version,
           input_sha256, max_cost_minor, max_provider_cost_units, failure_code
         ) VALUES (
           ?1, ?2, ?3, ?4, 'failed', 'simulation', ?5, ?6, 0, ?7, 0, 1, ?8
         )`,
      ).bind(
        `${jobId}-invalid`,
        workspaceId,
        assetId,
        userId,
        "generation-code-invalid-idempotency",
        "generation-code-invalid-workflow",
        sourceSha256,
        "GENERATION-WORKFLOW-FAILED",
      ),
    );

    await env.DB.prepare(
      `INSERT INTO generation_job_events (
         id, workspace_id, job_id, status, event_type, failure_code
       ) VALUES (?1, ?2, ?3, 'failed', 'constraint_fixture', 'GENERATION_WORKFLOW_FAILED')`,
    )
      .bind("generation-code-event", workspaceId, jobId)
      .run();
    await expectInvalidCode(
      env.DB.prepare(
        "UPDATE generation_job_events SET failure_code = ?1 WHERE id = ?2",
      ).bind("generation workflow failed", "generation-code-event"),
    );
    await expectInvalidCode(
      env.DB.prepare(
        `INSERT INTO generation_job_events (
           id, workspace_id, job_id, status, event_type, failure_code
         ) VALUES (?1, ?2, ?3, 'failed', 'constraint_fixture', ?4)`,
      ).bind(
        "generation-code-event-invalid",
        workspaceId,
        jobId,
        `A${"B".repeat(128)}`,
      ),
    );

    await env.DB.prepare(
      `INSERT INTO generation_provider_attempts (
         id, workspace_id, job_id, attempt_key, status, cost_units,
         duration_ms, validation_code
       ) VALUES (?1, ?2, ?3, 'primary', 'failed', 0, 1, 'GLB_VALID')`,
    )
      .bind("generation-code-attempt", workspaceId, jobId)
      .run();
    await expectInvalidCode(
      env.DB.prepare(
        "UPDATE generation_provider_attempts SET validation_code = ?1 WHERE id = ?2",
      ).bind("GLB VALID", "generation-code-attempt"),
    );
    await expectInvalidCode(
      env.DB.prepare(
        `INSERT INTO generation_provider_attempts (
           id, workspace_id, job_id, attempt_key, status, cost_units,
           duration_ms, validation_code
         ) VALUES (?1, ?2, ?3, 'secondary', 'failed', 0, 1, ?4)`,
      ).bind(
        "generation-code-attempt-invalid",
        workspaceId,
        jobId,
        "glb_valid",
      ),
    );

    const retained = await env.DB.prepare(
      `SELECT failure_code, validation_code
       FROM generation_jobs
       WHERE workspace_id = ?1 AND id = ?2`,
    )
      .bind(workspaceId, jobId)
      .first<{ failure_code: string; validation_code: string | null }>();
    expect(retained).toEqual({
      failure_code: "GENERATION_WORKFLOW_FAILED",
      validation_code: null,
    });
  });
});
