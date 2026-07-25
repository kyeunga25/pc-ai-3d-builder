PRAGMA foreign_keys = ON;

CREATE TABLE product_assets (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  catalog_part_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'in_review', 'approved', 'rejected')),
  quality TEXT NOT NULL DEFAULT 'unreviewed'
    CHECK (quality IN ('unreviewed', 'draft', 'reviewed', 'approved')),
  source_kind TEXT NOT NULL
    CHECK (source_kind IN ('synthetic', 'uploaded', 'generated')),
  completed_checks_json TEXT NOT NULL DEFAULT '[]'
    CHECK (json_valid(completed_checks_json)),
  source_rights_confirmed INTEGER NOT NULL DEFAULT 0
    CHECK (source_rights_confirmed IN (0, 1)),
  verified_width_mm REAL
    CHECK (verified_width_mm IS NULL OR (verified_width_mm > 0 AND verified_width_mm <= 10000)),
  verified_height_mm REAL
    CHECK (verified_height_mm IS NULL OR (verified_height_mm > 0 AND verified_height_mm <= 10000)),
  verified_depth_mm REAL
    CHECK (verified_depth_mm IS NULL OR (verified_depth_mm > 0 AND verified_depth_mm <= 10000)),
  review_version INTEGER NOT NULL DEFAULT 0 CHECK (review_version >= 0),
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  approved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  approved_at TEXT,
  rejected_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workspace_id, catalog_part_id)
    REFERENCES catalog_parts(workspace_id, id) ON DELETE CASCADE,
  UNIQUE (workspace_id, catalog_part_id),
  UNIQUE (workspace_id, id)
);

CREATE TABLE asset_review_events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  reviewer_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  decision TEXT NOT NULL
    CHECK (decision IN ('save_draft', 'approve', 'reject')),
  review_version INTEGER NOT NULL CHECK (review_version > 0),
  completed_checks_json TEXT NOT NULL CHECK (json_valid(completed_checks_json)),
  verified_width_mm REAL
    CHECK (verified_width_mm IS NULL OR (verified_width_mm > 0 AND verified_width_mm <= 10000)),
  verified_height_mm REAL
    CHECK (verified_height_mm IS NULL OR (verified_height_mm > 0 AND verified_height_mm <= 10000)),
  verified_depth_mm REAL
    CHECK (verified_depth_mm IS NULL OR (verified_depth_mm > 0 AND verified_depth_mm <= 10000)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workspace_id, asset_id)
    REFERENCES product_assets(workspace_id, id) ON DELETE CASCADE,
  UNIQUE (asset_id, review_version)
);

CREATE INDEX idx_product_assets_workspace_status_updated
ON product_assets(workspace_id, status, updated_at, id);

CREATE INDEX idx_asset_review_events_workspace_asset
ON asset_review_events(workspace_id, asset_id, review_version DESC);

UPDATE rigstage_metadata
SET value = '4', updated_at = CURRENT_TIMESTAMP
WHERE key = 'schema_phase';
