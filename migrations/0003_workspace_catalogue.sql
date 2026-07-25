PRAGMA foreign_keys = ON;

CREATE TABLE catalog_parts (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  sku TEXT NOT NULL COLLATE NOCASE,
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
  manufacturer TEXT NOT NULL,
  model TEXT NOT NULL,
  price_minor INTEGER NOT NULL DEFAULT 0 CHECK (price_minor >= 0),
  stock_status TEXT NOT NULL DEFAULT 'unknown'
    CHECK (stock_status IN ('in_stock', 'low_stock', 'out_of_stock', 'unknown')),
  stock_count INTEGER CHECK (stock_count IS NULL OR stock_count >= 0),
  specifications_json TEXT NOT NULL DEFAULT '{}'
    CHECK (json_valid(specifications_json)),
  specification_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (specification_status IN ('unverified', 'verified')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (workspace_id, sku),
  UNIQUE (workspace_id, id)
);

CREATE INDEX idx_catalog_parts_workspace_status_id
ON catalog_parts(workspace_id, status, id);

CREATE INDEX idx_catalog_parts_workspace_category
ON catalog_parts(workspace_id, category, status, id);

UPDATE rigstage_metadata
SET value = '3', updated_at = CURRENT_TIMESTAMP
WHERE key = 'schema_phase';
