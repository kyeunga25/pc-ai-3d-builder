PRAGMA foreign_keys = ON;

CREATE TRIGGER product_assets_require_active_catalogue_update
BEFORE UPDATE ON product_assets
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM catalog_parts
  WHERE workspace_id = OLD.workspace_id
    AND id = OLD.catalog_part_id
    AND status = 'active'
)
BEGIN
  SELECT RAISE(ABORT, 'ASSET_CATALOGUE_INACTIVE');
END;

UPDATE rigstage_metadata
SET value = '14', updated_at = CURRENT_TIMESTAMP
WHERE key = 'schema_phase';
