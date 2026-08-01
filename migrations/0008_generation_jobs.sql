PRAGMA foreign_keys = ON;

CREATE TABLE generation_jobs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  requested_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (
      status IN (
        'queued',
        'running',
        'validating',
        'awaiting_review',
        'failed',
        'cancelled'
      )
    ),
  execution_mode TEXT NOT NULL
    CHECK (execution_mode IN ('simulation')),
  idempotency_key TEXT NOT NULL,
  workflow_instance_id TEXT NOT NULL,
  requested_review_version INTEGER NOT NULL
    CHECK (requested_review_version >= 0),
  input_sha256 TEXT NOT NULL CHECK (length(input_sha256) = 64),
  max_cost_minor INTEGER NOT NULL DEFAULT 0 CHECK (max_cost_minor >= 0),
  actual_cost_minor INTEGER
    CHECK (actual_cost_minor IS NULL OR actual_cost_minor >= 0),
  output_object_key TEXT,
  output_content_type TEXT
    CHECK (
      output_content_type IS NULL
      OR output_content_type = 'model/gltf-binary'
    ),
  output_size_bytes INTEGER
    CHECK (output_size_bytes IS NULL OR output_size_bytes > 0),
  output_sha256 TEXT
    CHECK (output_sha256 IS NULL OR length(output_sha256) = 64),
  previous_model_object_key TEXT,
  failure_code TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  FOREIGN KEY (workspace_id, asset_id)
    REFERENCES product_assets(workspace_id, id) ON DELETE CASCADE,
  UNIQUE (workspace_id, id),
  UNIQUE (workspace_id, idempotency_key),
  UNIQUE (workflow_instance_id),
  CHECK (
    (
      output_object_key IS NULL
      AND output_content_type IS NULL
      AND output_size_bytes IS NULL
      AND output_sha256 IS NULL
    )
    OR (
      output_object_key IS NOT NULL
      AND output_content_type IS NOT NULL
      AND output_size_bytes IS NOT NULL
      AND output_sha256 IS NOT NULL
    )
  )
);

CREATE TABLE generation_job_events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  job_id TEXT NOT NULL,
  status TEXT NOT NULL
    CHECK (
      status IN (
        'queued',
        'running',
        'validating',
        'awaiting_review',
        'failed',
        'cancelled'
      )
    ),
  event_type TEXT NOT NULL,
  failure_code TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}'
    CHECK (json_valid(metadata_json)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workspace_id, job_id)
    REFERENCES generation_jobs(workspace_id, id) ON DELETE CASCADE
);

CREATE INDEX idx_generation_jobs_workspace_asset_created
ON generation_jobs(workspace_id, asset_id, created_at DESC, id);

CREATE UNIQUE INDEX idx_generation_jobs_asset_active
ON generation_jobs(workspace_id, asset_id)
WHERE status IN ('queued', 'running', 'validating');

CREATE INDEX idx_generation_job_events_workspace_job_created
ON generation_job_events(workspace_id, job_id, created_at, id);

UPDATE rigstage_metadata
SET value = '8', updated_at = CURRENT_TIMESTAMP
WHERE key = 'schema_phase';
