PRAGMA foreign_keys = ON;

ALTER TABLE catalog_parts
ADD COLUMN record_version INTEGER NOT NULL DEFAULT 0
  CHECK (record_version >= 0);

CREATE INDEX idx_catalog_parts_workspace_updated
ON catalog_parts(workspace_id, status, updated_at DESC, id);

UPDATE rigstage_metadata
SET value = '5', updated_at = CURRENT_TIMESTAMP
WHERE key = 'schema_phase';
