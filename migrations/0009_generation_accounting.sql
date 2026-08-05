PRAGMA foreign_keys = ON;

ALTER TABLE generation_jobs
ADD COLUMN max_provider_cost_units INTEGER NOT NULL DEFAULT 1
  CHECK (max_provider_cost_units BETWEEN 0 AND 1000);

ALTER TABLE generation_jobs
ADD COLUMN provider_cost_units INTEGER
  CHECK (provider_cost_units IS NULL OR provider_cost_units BETWEEN 0 AND 1000);

ALTER TABLE generation_jobs
ADD COLUMN validation_code TEXT
  CHECK (validation_code IS NULL OR length(validation_code) BETWEEN 1 AND 128);

CREATE TABLE generation_credit_accounts (
  workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  available_units INTEGER NOT NULL DEFAULT 0 CHECK (available_units >= 0),
  reserved_units INTEGER NOT NULL DEFAULT 0 CHECK (reserved_units >= 0),
  settled_units INTEGER NOT NULL DEFAULT 0 CHECK (settled_units >= 0),
  released_units INTEGER NOT NULL DEFAULT 0 CHECK (released_units >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE generation_job_entitlements (
  workspace_id TEXT NOT NULL,
  job_id TEXT NOT NULL,
  units INTEGER NOT NULL CHECK (units BETWEEN 1 AND 1000),
  status TEXT NOT NULL DEFAULT 'reserved'
    CHECK (status IN ('reserved', 'settled', 'released')),
  reserved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  settled_at TEXT,
  released_at TEXT,
  release_reason_code TEXT
    CHECK (
      release_reason_code IS NULL
      OR length(release_reason_code) BETWEEN 1 AND 128
    ),
  PRIMARY KEY (workspace_id, job_id),
  FOREIGN KEY (workspace_id, job_id)
    REFERENCES generation_jobs(workspace_id, id) ON DELETE CASCADE
);

CREATE TABLE generation_credit_events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  job_id TEXT NOT NULL,
  event_type TEXT NOT NULL
    CHECK (event_type IN ('reserve', 'settle', 'release')),
  units INTEGER NOT NULL CHECK (units BETWEEN 1 AND 1000),
  reason_code TEXT
    CHECK (reason_code IS NULL OR length(reason_code) BETWEEN 1 AND 128),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workspace_id, job_id)
    REFERENCES generation_jobs(workspace_id, id) ON DELETE CASCADE,
  UNIQUE (workspace_id, job_id, event_type)
);

CREATE TABLE generation_provider_attempts (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  job_id TEXT NOT NULL,
  attempt_key TEXT NOT NULL
    CHECK (length(attempt_key) BETWEEN 1 AND 64),
  status TEXT NOT NULL DEFAULT 'started'
    CHECK (status IN ('started', 'succeeded', 'failed')),
  cost_units INTEGER CHECK (cost_units IS NULL OR cost_units BETWEEN 0 AND 1000),
  duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms >= 0),
  validation_code TEXT
    CHECK (validation_code IS NULL OR length(validation_code) BETWEEN 1 AND 128),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  FOREIGN KEY (workspace_id, job_id)
    REFERENCES generation_jobs(workspace_id, id) ON DELETE CASCADE,
  UNIQUE (workspace_id, job_id, attempt_key)
);

CREATE INDEX idx_generation_entitlements_workspace_status
ON generation_job_entitlements(workspace_id, status, job_id);

CREATE INDEX idx_generation_credit_events_workspace_created
ON generation_credit_events(workspace_id, created_at DESC, id);

CREATE INDEX idx_generation_attempts_workspace_job
ON generation_provider_attempts(workspace_id, job_id, created_at, id);

UPDATE rigstage_metadata
SET value = '9', updated_at = CURRENT_TIMESTAMP
WHERE key = 'schema_phase';
