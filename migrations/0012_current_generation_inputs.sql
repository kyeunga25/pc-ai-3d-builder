PRAGMA foreign_keys = ON;

CREATE TRIGGER generation_jobs_require_current_asset
BEFORE INSERT ON generation_jobs
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM product_assets AS a
  INNER JOIN catalog_parts AS p
    ON p.workspace_id = a.workspace_id
   AND p.id = a.catalog_part_id
  WHERE a.workspace_id = NEW.workspace_id
    AND a.id = NEW.asset_id
    AND p.status = 'active'
    AND a.status <> 'approved'
    AND a.review_version = NEW.requested_review_version
    AND a.source_sha256 = NEW.input_sha256
    AND a.source_rights_confirmed = 1
)
BEGIN
  SELECT RAISE(ABORT, 'GENERATION_INPUT_STALE');
END;

UPDATE rigstage_metadata
SET value = '12', updated_at = CURRENT_TIMESTAMP
WHERE key = 'schema_phase';
