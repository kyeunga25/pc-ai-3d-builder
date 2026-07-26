PRAGMA foreign_keys = ON;

CREATE UNIQUE INDEX idx_catalog_parts_workspace_id_category
ON catalog_parts(workspace_id, id, category);

CREATE TABLE builds (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL
    CHECK (length(trim(name)) BETWEEN 1 AND 120),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'archived')),
  record_version INTEGER NOT NULL DEFAULT 0
    CHECK (record_version >= 0),
  mutation_token TEXT NOT NULL,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (workspace_id, id)
);

CREATE TABLE build_items (
  workspace_id TEXT NOT NULL,
  build_id TEXT NOT NULL,
  category TEXT NOT NULL
    CHECK (
      category IN (
        'case',
        'motherboard',
        'cpu',
        'gpu',
        'memory',
        'cooling',
        'storage',
        'psu',
        'fans'
      )
    ),
  catalog_part_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (workspace_id, build_id, category),
  FOREIGN KEY (workspace_id, build_id)
    REFERENCES builds(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, catalog_part_id, category)
    REFERENCES catalog_parts(workspace_id, id, category) ON DELETE RESTRICT
);

CREATE INDEX idx_builds_workspace_status_updated
ON builds(workspace_id, status, updated_at DESC, id);

CREATE INDEX idx_build_items_workspace_part
ON build_items(workspace_id, catalog_part_id, build_id);

UPDATE rigstage_metadata
SET value = '7', updated_at = CURRENT_TIMESTAMP
WHERE key = 'schema_phase';
