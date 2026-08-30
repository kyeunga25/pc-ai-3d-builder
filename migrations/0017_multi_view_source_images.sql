PRAGMA foreign_keys = ON;

CREATE TABLE product_asset_source_files (
  workspace_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  source_view TEXT NOT NULL
    CHECK (source_view IN ('back', 'left', 'three-quarter')),
  object_key TEXT NOT NULL
    CHECK (length(object_key) BETWEEN 1 AND 1024),
  content_type TEXT NOT NULL
    CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes INTEGER NOT NULL
    CHECK (size_bytes BETWEEN 1 AND 10485760),
  sha256 TEXT NOT NULL
    CHECK (
      length(sha256) = 64
      AND sha256 NOT GLOB '*[^0-9a-f]*'
    ),
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (workspace_id, asset_id, source_view),
  FOREIGN KEY (workspace_id, asset_id)
    REFERENCES product_assets(workspace_id, id) ON DELETE CASCADE
);

CREATE TRIGGER product_asset_source_files_require_active_catalogue_insert
BEFORE INSERT ON product_asset_source_files
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM product_assets AS asset
  INNER JOIN catalog_parts AS part
    ON part.workspace_id = asset.workspace_id
   AND part.id = asset.catalog_part_id
  WHERE asset.workspace_id = NEW.workspace_id
    AND asset.id = NEW.asset_id
    AND part.status = 'active'
)
BEGIN
  SELECT RAISE(ABORT, 'ASSET_CATALOGUE_INACTIVE');
END;

CREATE TRIGGER product_asset_source_files_require_active_catalogue_update
BEFORE UPDATE ON product_asset_source_files
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM product_assets AS asset
  INNER JOIN catalog_parts AS part
    ON part.workspace_id = asset.workspace_id
   AND part.id = asset.catalog_part_id
  WHERE asset.workspace_id = NEW.workspace_id
    AND asset.id = NEW.asset_id
    AND part.status = 'active'
)
BEGIN
  SELECT RAISE(ABORT, 'ASSET_CATALOGUE_INACTIVE');
END;

UPDATE rigstage_metadata
SET value = '17', updated_at = CURRENT_TIMESTAMP
WHERE key = 'schema_phase';
