PRAGMA foreign_keys = ON;

CREATE TRIGGER catalog_parts_protect_reserved_generation_review
BEFORE UPDATE OF status ON catalog_parts
FOR EACH ROW
WHEN OLD.status = 'active'
  AND NEW.status = 'archived'
  AND EXISTS (
    SELECT 1
    FROM product_assets AS a
    INNER JOIN generation_jobs AS j
      ON j.workspace_id = a.workspace_id
     AND j.asset_id = a.id
    INNER JOIN generation_job_entitlements AS e
      ON e.workspace_id = j.workspace_id
     AND e.job_id = j.id
    WHERE a.workspace_id = OLD.workspace_id
      AND a.catalog_part_id = OLD.id
      AND j.status = 'awaiting_review'
      AND e.status = 'reserved'
  )
BEGIN
  SELECT RAISE(ABORT, 'CATALOGUE_GENERATION_RESERVED');
END;

UPDATE rigstage_metadata
SET value = '13', updated_at = CURRENT_TIMESTAMP
WHERE key = 'schema_phase';
