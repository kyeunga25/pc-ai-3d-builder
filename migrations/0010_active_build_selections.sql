PRAGMA foreign_keys = ON;

CREATE TRIGGER build_items_require_active_catalogue_part
BEFORE INSERT ON build_items
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM catalog_parts
  WHERE workspace_id = NEW.workspace_id
    AND id = NEW.catalog_part_id
    AND category = NEW.category
    AND status = 'active'
)
BEGIN
  SELECT RAISE(ABORT, 'BUILD_SELECTION_INACTIVE');
END;

UPDATE rigstage_metadata
SET value = '10', updated_at = CURRENT_TIMESTAMP
WHERE key = 'schema_phase';
